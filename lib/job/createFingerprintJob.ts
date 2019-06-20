import {
    AutomationContextAware,
    CommandIncoming,
    GraphQL,
    guid,
    logger,
    QueryNoCacheOptions,
    Secrets,
    Success,
} from "@atomist/automation-client";
import { EventHandlerRegistration } from "@atomist/sdm";
import { createJob } from "@atomist/sdm-core";
import { bold } from "@atomist/slack-messages";
import {
    AtmJobState,
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

        if (job.state === AtmJobState.completed && job.name === "Discovering repositories") {

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
                    name: org.owner,
                    tasks: org.repos.map(repo => {
                        return {
                            name: calculateFingerprintTask([], []).name,
                            parameters: {
                                providerId: provider.providerId,
                                repoId: repo.id,
                                owner: repo.owner,
                                name: repo.name,
                                branch: repo.defaultBranch || "master",
                            },
                        };
                    }),
                };
            });

            for (const org of orgs) {
                try {
                    await createJob<CalculateFingerprintTaskParameters>(
                        `Analyzing repositories in ${bold(org.name)}`,
                        org.tasks,
                        ctx);
                } catch (e) {
                    logger.warn("Failed to create job for org '%s': %s", org.name, e.message);
                }
            }
        }
        return Success;
    },
};
