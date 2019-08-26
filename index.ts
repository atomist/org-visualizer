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

// Org Visualizer should be used in local mode. This is to enforce that!
import { VirtualProjectFinder } from "@atomist/sdm-pack-fingerprints";

process.env.ATOMIST_MODE = "local";

import { Configuration } from "@atomist/automation-client";
import { loadUserConfiguration } from "@atomist/automation-client/lib/configuration";
import { PushImpact } from "@atomist/sdm";
import { configure } from "@atomist/sdm-core";
import {
    aspectSupport, DefaultVirtualProjectFinder,
} from "@atomist/sdm-pack-aspect";
import { PostgresProjectAnalysisResultStore } from "@atomist/sdm-pack-aspect/lib/analysis/offline/persist/PostgresProjectAnalysisResultStore";
import { storeFingerprints } from "@atomist/sdm-pack-aspect/lib/aspect/delivery/storeFingerprintsPublisher";
import { sdmConfigClientFactory } from "@atomist/sdm-pack-aspect/lib/machine/machine";
import { aspects } from "./lib/aspect/aspects";
import { scorers } from "./lib/scorer/scorers";
import {
    combinationTaggers,
    taggers,
} from "./lib/tagger/taggers";
import { demoUndesirableUsageChecker } from "./lib/usage/demoUndesirableUsageChecker";
import { startEmbeddedPostgres } from "./lib/util/postgres";

const virtualProjectFinder: VirtualProjectFinder = DefaultVirtualProjectFinder;

const store = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory(loadUserConfiguration()));

export const configuration: Configuration = configure(async sdm => {

        const pushImpact = new PushImpact();

        sdm.addExtensionPacks(
            aspectSupport({
                aspects: aspects(),

                scorers: scorers(),

                taggers: taggers({}),
                combinationTaggers: combinationTaggers({}),

                goals: {
                    // This enables fingerprints to be computed on push
                    pushImpact,
                },

                undesirableUsageChecker: demoUndesirableUsageChecker,
                virtualProjectFinder,
                publishFingerprints: storeFingerprints(store),
            }),
        );
    },
    {
        name: "Org Visualizer",
        preProcessors: [startEmbeddedPostgres],
    });
