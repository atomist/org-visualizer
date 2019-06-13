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
import { PushImpact } from "@atomist/sdm";
import { configure } from "@atomist/sdm-core";
import {
    DockerFrom,
    fingerprintSupport,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import {
    analysisResultStore,
    clientFactory,
} from "./lib/machine/machine";
import { api } from "./lib/routes/api";
import { orgPage } from "./lib/routes/orgPage";

export const configuration: Configuration = configure(async sdm => {

    // Do not surface the single pushImpact goal set in every UI
    sdm.configuration.sdm.tagGoalSet = async () => [{ name: "@atomist/atomist/internal", value: JSON.stringify(true) }];

    const pushImpact = new PushImpact();

    sdm.addExtensionPacks(
        fingerprintSupport({
        pushImpactGoal: pushImpact,
        features: [
            NpmDeps,
            DockerFrom,
        ],
        handlers: [],
    }));

    return {
        analyze: {
            goals: pushImpact,
        },
    };

}, {
    name: "Analysis Software Delivery Machine",
    postProcessors: [
        async cfg => {

            const resultStore = analysisResultStore(clientFactory(cfg));
            const staticPages = !["production", "testing"].includes(process.env.NODE_ENV) ? [orgPage(resultStore)] : [];

            cfg.http.customizers = [
                ...staticPages,
                api(clientFactory(cfg), resultStore),
            ];
            return cfg;
        },
    ],
});
