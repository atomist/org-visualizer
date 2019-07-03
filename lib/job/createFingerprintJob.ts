/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    configurationValue,
    GraphQL,
    logger,
    QueryNoCacheOptions,
    Success,
} from "@atomist/automation-client";
import {
    createJob,
    EventHandlerRegistration,
    PreferenceScope,
    PreferenceStore,
    PreferenceStoreFactory,
} from "@atomist/sdm";
import { bold } from "@atomist/slack-messages";
import {
    OnDiscoveryJob,
    ReposByProvider,
} from "../typings/types";
import {
    calculateFingerprintTask,
    CalculateFingerprintTaskParameters,
} from "./fingerprintTask";

export const CreateFingerprintJob: EventHandlerRegistration<OnDiscoveryJob.Subscription> = {
    name: "CreateFingerprintJob",
    description: "Creates a job that calculates the fingerprints on every repo of an org",
    subscription: GraphQL.subscription("OnDiscoveryJob"),
    listener: async (e, ctx) => {
        const job = e.data.AtmJob[0];

        if (job.name.startsWith("RepositoryDiscovery/zjlmxjzwhurspem")) {

            // Query all orgs and repos and create a Fingerprint command for each
            const result = await ctx.graphClient.query<ReposByProvider.Query, ReposByProvider.Variables>({
                name: "ReposByProvider",
                variables: {
                    providerId: "zjlmxjzwhurspem",
                },
                options: QueryNoCacheOptions,
            });

            const orgs = result.Org.map(org => {
                const provider = org.scmProvider;
                return {
                    providerId: provider.providerId,
                    name: org.owner,
                    tasks: org.repos.map(repo => {
                        return {
                            providerId: provider.providerId,
                            repoId: repo.id,
                            owner: repo.owner,
                            name: repo.name,
                            branch: repo.defaultBranch || "master",
                        };
                    }),
                };
            });

            const prefs: PreferenceStore = configurationValue<PreferenceStoreFactory>("sdm.preferenceStoreFactory")(ctx);

            for (const org of orgs) {
                const analyzed = await prefs.get<boolean>(preferenceKey(org.name), { scope: PreferenceScope.Sdm, defaultValue: false });
                if (!analyzed) {
                    try {
                        await createJob<CalculateFingerprintTaskParameters>({
                                command: calculateFingerprintTask([], []),
                                parameters: org.tasks,
                                name: `OrganizationAnalysis/${org.providerId}/${org.name}`,
                                description: `Analyzing repositories in ${bold(org.name)}`,
                            },
                            ctx);
                        await prefs.put<boolean>(preferenceKey(org.name), true, { scope: PreferenceScope.Sdm });
                    } catch (e) {
                        logger.warn("Failed to create job for org '%s': %s", org.name, e.message);
                    }
                }
            }
        }
        return Success;
    },
};

function preferenceKey(org: string): string {
    return `analyzed/${org}`;
}
