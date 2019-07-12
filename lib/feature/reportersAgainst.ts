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
    Ideal,
    isConcreteIdeal,
} from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { FingerprintKind } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { treeBuilderFor } from "../routes/wellKnownReporters";
import { AspectRegistry } from "./AspectRegistry";
import { Reporters } from "./reporters";
import { defaultAnalyzedRenderer } from "./support/groupingUtils";

/**
 * Create an object exposing well-known queries against our repo cohort
 * based on the fingerprints the given AspectRegistry knows how to manage.
 * Return a query named "flagged" that shows any flagged fingerprints, across all repos.
 */
export async function reportersAgainst(
    relevantFingerprintKinds: () => Promise<FingerprintKind[]>,
    featureManager: AspectRegistry): Promise<Reporters> {
    const reporters: Reporters = {};

    // Report bad fingerprints according to the AspectRegistry
    reporters.flagged = params =>
        treeBuilderFor("flagged", params)
            .group({
                name: "flags",
                by: async hf => {
                    const knownBad = await featureManager.findUndesirableUsages("local", hf);
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        "-" + knownBad.length;
                },
            })
            .group({
                name: "violations",
                by: async hf => {
                    const knownBad = await featureManager.findUndesirableUsages("local", hf);
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        _.uniq(knownBad.map(bad => bad.message)).join(",");
                },
            })
            .renderWith(defaultAnalyzedRenderer());

    return reporters;
}
