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
import { DockerFrom } from "@atomist/sdm-pack-docker";
import {
    fingerprintSupport,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import {
    ciFeature,
    javaBuildFeature,
    stackFeature,
} from "./lib/feature/common/stackFeature";
import { springBootVersionFeature } from "./lib/feature/spring/springBootVersionFeature";
import { CreateFingerprintJob } from "./lib/job/createFingerprintJob";
import { calculateFingerprintTask } from "./lib/job/fingerprintTask";
import {
    analysisResultStore,
    sdmConfigClientFactory,
} from "./lib/machine/machine";
import { api } from "./lib/routes/api";
import { orgPage } from "./lib/routes/orgPage";

export const configuration: Configuration = configure(async sdm => {

    // Do not surface the single pushImpact goal set in every UI
    sdm.configuration.sdm.tagGoalSet = async () => [{ name: "@atomist/sdm/internal" }];
    // Use lazy project loader for this SDM
    sdm.configuration.sdm.projectLoader = new GitHubLazyProjectLoader(new CachingProjectLoader());
    // Disable goal hooks from repos
    sdm.configuration.sdm.goal = {
        hooks: false,
    };
    // For safety we sign every goal
    sdm.configuration.sdm.goalSigning = {
        ...sdm.configuration.sdm.goalSigning,
        scope: GoalSigningScope.All,
    };

    const pushImpact = new PushImpact();

    const features = [
        NpmDeps,
        DockerFrom,
        springBootVersionFeature,
        stackFeature,
        ciFeature,
        javaBuildFeature,
    ];
    const handlers = [];

    sdm.addExtensionPacks(
        fingerprintSupport({
            pushImpactGoal: pushImpact,
            features,
            handlers,
        }));

    sdm.addEvent(CreateFingerprintJob);
    sdm.addCommand(calculateFingerprintTask(features, handlers));

    return {
        analyze: {
            goals: pushImpact,
        },
    };

}, {
    name: "Analysis Software Delivery Machine",
    postProcessors: [
        configureHumio,
        async cfg => {

            const resultStore = analysisResultStore(sdmConfigClientFactory(cfg));
            const staticPages = !["production", "testing"].includes(process.env.NODE_ENV) ? [orgPage(resultStore)] : [];

            cfg.http.customizers = [
                ...staticPages,
                api(sdmConfigClientFactory(cfg), resultStore),
            ];
            return cfg;
        },
    ],
});
