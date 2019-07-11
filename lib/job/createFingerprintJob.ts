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
    OnGitHubAppInstallation,
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

            if (job.name.startsWith("RepositoryDiscovery")) {

                const event = JSON.parse(job.data) as OnGitHubAppInstallation.Subscription;
                const org = event.GitHubAppInstallation[0];
                const provider = event.GitHubAppInstallation[0].gitHubAppResourceProvider;

                // Query all orgs and repos and create a Fingerprint command for each
                const result = await ctx.graphClient.query<ReposByProvider.Query, ReposByProvider.Variables>({
                    name: "ReposByProvider",
                    variables: {
                        providerId: provider.providerId,
                        org: org.owner,
                    },
                });

                const repos = {
                    providerId: provider.providerId,
                    name: org.owner,
                    tasks: result.Org[0].repos.map(repo => {
                        return {
                            providerId: provider.providerId,
                            repoId: repo.id,
                            owner: repo.owner,
                            name: repo.name,
                            branch: repo.defaultBranch || "master",
                        };
                    }),
                };

                const prefs: PreferenceStore = configurationValue<PreferenceStoreFactory>("sdm.preferenceStoreFactory")(ctx);

                const analyzed = await prefs.get<boolean>(preferenceKey(org.owner), { scope: PreferenceScope.Sdm, defaultValue: false });
                if (!analyzed) {
                    try {
                        await createJob<CalculateFingerprintTaskParameters>({
                                command: calculateFingerprintTask([], [], undefined),
                                parameters: repos.tasks,
                                name: `OrganizationAnalysis/${provider.providerId}/${org.owner}`,
                                description: `Analyzing repositories in ${bold(org.owner)}`,
                            },
                            ctx);
                        await prefs.put<boolean>(preferenceKey(org.owner), true, { scope: PreferenceScope.Sdm });
                    } catch (e) {
                        logger.warn("Failed to create job for org '%s': %s", org.owner, e.message);
                    }
                }
            }
            return Success;
        },
    }
;

function preferenceKey(org: string): string {
    return `analyzed/${org}`;
}
