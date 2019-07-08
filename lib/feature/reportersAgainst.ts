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
import { treeBuilderFor } from "../routes/wellKnownReporters";
import {
    allFingerprints,
    defaultedToDisplayableFingerprint,
    fingerprintsFrom,
} from "./DefaultFeatureManager";
import {
    FeatureManager,
    HasFingerprints,
    UndesirableUsage,
} from "./FeatureManager";
import { Reporters } from "./reporters";
import { defaultAnalyzedRenderer } from "./support/groupingUtils";

/**
 * Create an object exposing well-known queries against our repo cohort
 * based on the fingerprints the given FeatureManager knows how to manage.
 * Return a query named "flagged" that shows any flagged fingerprints, across all repos.
 * Return 3 queries for each fingerprint name
 * 1. <fingerprintName>: Show distribution of the fingerprint
 * 2. <fingerprintName>-present: Is this fingerprint name present in this repo? Returns for all repos
 * 3. <fingerprintName>-progress: Show progress toward the ideal for this fingerprint name
 */
export async function reportersAgainst(featureManager: FeatureManager,
                                       repos: HasFingerprints[] | AsyncIterable<HasFingerprints>): Promise<Reporters> {
    const reporters: Reporters = {};

    // Report bad fingerprints according to the FeatureManager
    reporters.flagged = params =>
        treeBuilderFor("flagged", params)
            .group({
                name: "flags",
                by: async hf => {
                    const knownBad = await featureManager.findUndesirableUsages(hf);
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        "-" + knownBad.length;
                },
            })
            .group({
                name: "violations",
                by: async hf => {
                    const knownBad = await featureManager.findUndesirableUsages(hf);
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        knownBad.map(bad => bad.message).join(",");
                },
            })
            .renderWith(defaultAnalyzedRenderer());

    for await (const fingerprint of fingerprintsFrom(repos)) {
        const name = fingerprint.name;
        if (reporters[fingerprint.name]) {
            // Don't set it again
            continue;
        }

        reporters[name] = params =>
            treeBuilderFor(name, params)
                .group({
                    name,
                    by: hf => {
                        const fp = hf.fingerprints[name];
                        return !!fp ? defaultedToDisplayableFingerprint(featureManager.featureFor(fp))(fp) : undefined;
                    },
                })
                .renderWith(defaultAnalyzedRenderer());

        reporters[name + "-present"] = params =>
            treeBuilderFor(name, params)
                .group({
                    name,
                    by: hf => {
                        const found = hf.fingerprints.find(fp => fp.name === name);
                        return !!found ? "Yes" : "No";
                    },
                })
                .renderWith(defaultAnalyzedRenderer());

        // Add a query that tells us how many repositories are on vs off the ideal, if any, for this fingerprint
        reporters[name + "-progress"] = params => {
            let ideal: Ideal;
            return treeBuilderFor(name, params)
                .group({
                    name: name + " progress?",
                    by: async hf => {
                        const name = params.name.replace("-progress", "");
                        const found = hf.fingerprints.find(fp => fp.name === name && fp.type === params.type);
                        if (!found) {
                            return undefined;
                        }

                        if (!ideal) {
                            ideal = await featureManager.idealStore.fetchIdeal("local", params.type, name);
                        }
                        if (!ideal) {
                            throw new Error(`No ideal for ${params.type}/${name}`);
                        }
                        if (!isConcreteIdeal(ideal)) {
                            return !found ? `Yes (gone)` : "No (present)";
                        }

                        const feature = featureManager.featureFor(found.type);
                        if (ideal && ideal.ideal) {
                            return found.sha === ideal.ideal.sha ? `Yes (${defaultedToDisplayableFingerprint(feature)(ideal.ideal)})` : "No";
                        }
                        return !!found ? defaultedToDisplayableFingerprint(feature)(found) : undefined;
                    },
                })
                .renderWith(defaultAnalyzedRenderer());
        };
    }

    return reporters;
}
