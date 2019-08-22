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
process.env.ATOMIST_MODE = "local";

import { Configuration } from "@atomist/automation-client";
import { configure } from "@atomist/sdm-core";
import {
    aspectSupport,
    combinationTaggers,
} from "@atomist/sdm-pack-aspect";
import { aspects } from "./lib/aspect/aspects";
import { scorers } from "./lib/scorer/scorers";
import { taggers } from "./lib/tagger/taggers";
import { demoUndesirableUsageChecker } from "./lib/usage/demoUndesirableUsageChecker";
import { startEmbeddedPostgres } from "./lib/util/postgres";

export const configuration: Configuration = configure(async sdm => {

        sdm.addExtensionPacks(
            aspectSupport({
                aspects: aspects(),

                scorers: scorers(),

                taggers: taggers({}),
                combinationTaggers: combinationTaggers({}),

                undesirableUsageChecker: demoUndesirableUsageChecker,
            }),
        );
    },
    {
        name: "Org Visualizer",
        preProcessors: [startEmbeddedPostgres],
    });
