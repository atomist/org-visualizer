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

import { Configuration } from "@atomist/automation-client";
import { configureHumio } from "@atomist/automation-client-ext-humio";
import {
    CachingProjectLoader,
    GitHubLazyProjectLoader,
    GoalSigningScope,
    PushImpact,
} from "@atomist/sdm";
import { configure } from "@atomist/sdm-core";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    fingerprintSupport,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import { Aspects } from "./lib/customize/aspects";
import { registerCategories } from "./lib/customize/categories";
import { demoUndesirableUsageChecker } from "./lib/customize/demoUndesirableUsageChecker";
import {
    CiFeature,
    JavaBuild,
    StackFeature,
} from "./lib/feature/common/stackFeature";
import { DefaultAspectRegistry } from "./lib/feature/DefaultAspectRegistry";
import { TypeScriptVersion } from "./lib/feature/node/TypeScriptVersion";
import { DirectMavenDependencies } from "./lib/feature/spring/directMavenDependencies";
import { SpringBootStarter } from "./lib/feature/spring/springBootStarter";
import { SpringBootVersion } from "./lib/feature/spring/springBootVersion";
import { TravisScriptsFeature } from "./lib/feature/travis/travisFeatures";
import { CreateFingerprintJob } from "./lib/job/createFingerprintJob";
import { calculateFingerprintTask } from "./lib/job/fingerprintTask";
import {
    analysisResultStore,
    sdmConfigClientFactory,
} from "./lib/machine/machine";
import { api } from "./lib/routes/api";
import { orgPage } from "./lib/routes/orgPage";

// Mode can be online or mode
const mode = process.env.ATOMIST_ORG_VISUALIZER_MODE || "online";

export const configuration: Configuration = configure(async sdm => {

        const jobFeatures = [
            DockerFrom,
            DockerfilePath,
            DockerPorts,
            SpringBootStarter,
            TypeScriptVersion,
            NpmDeps,
            TravisScriptsFeature,
            StackFeature,
            CiFeature,
            JavaBuild,
            SpringBootVersion,
            DirectMavenDependencies,
        ];
        const handlers = [];

        registerCategories(DockerFrom, "Docker");
        registerCategories(DockerfilePath, "Docker");
        registerCategories(DockerPorts, "Docker");
        registerCategories(SpringBootStarter, "Java");
        registerCategories(TypeScriptVersion, "TypeScript");
        registerCategories(NpmDeps, "Node.js");
        registerCategories(JavaBuild, "Java");
        registerCategories(SpringBootVersion, "Java");
        registerCategories(DirectMavenDependencies, "Java");

        if (mode === "online") {
            const pushImpact = new PushImpact();

            sdm.addExtensionPacks(
                fingerprintSupport({
                    pushImpactGoal: pushImpact,
                    features: jobFeatures,
                    handlers,
                }));

            return {
                analyze: {
                    goals: pushImpact,
                },
            };
        } else {
            sdm.addEvent(CreateFingerprintJob);
            sdm.addCommand(calculateFingerprintTask(jobFeatures, handlers));
            return {};
        }

    },
    {
        name: "Analysis Software Delivery Machine",
        preProcessors: async cfg => {

            // Do not surface the single pushImpact goal set in every UI
            cfg.sdm.tagGoalSet = async () => [{ name: "@atomist/sdm/internal" }];
            // Use lazy project loader for this SDM
            cfg.sdm.projectLoader = new GitHubLazyProjectLoader(new CachingProjectLoader());
            // Disable goal hooks from repos
            cfg.sdm.goal = {
                hooks: false,
            };
            // For safety we sign every goal
            cfg.sdm.goalSigning = {
                ...cfg.sdm.goalSigning,
                scope: GoalSigningScope.All,
            };

            if (mode === "job") {
                cfg.name = `${cfg.name}-job`;
                cfg.ws.termination = {
                    graceful: true,
                    gracePeriod: 1000 * 60 * 10,
                };
            }

            return cfg;
        },
        postProcessors: [
            configureHumio,
            async cfg => {
                const resultStore = analysisResultStore(sdmConfigClientFactory(cfg));
                const aspectRegistry = new DefaultAspectRegistry({
                    idealStore: resultStore,
                    features: Aspects,
                    undesirableUsageChecker: demoUndesirableUsageChecker,
                });
                const staticPages = !["production", "testing"].includes(process.env.NODE_ENV) ? [
                        orgPage(aspectRegistry, resultStore)] :
                    [];

                cfg.http.customizers = [
                    ...staticPages,
                    api(sdmConfigClientFactory(cfg), resultStore, aspectRegistry),
                ];
                return cfg;
            },
        ],
    });
