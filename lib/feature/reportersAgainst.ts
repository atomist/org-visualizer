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

import { treeBuilderFor } from "../routes/wellKnownReporters";
import { FeatureManager, Flag, HasFingerprints } from "./FeatureManager";
import { DefaultProjectAnalysisRenderer } from "./support/groupingUtils";

import * as _ from "lodash";
import { allFingerprints, defaultedToDisplayableFingerprint, fingerprintsFrom } from "./DefaultFeatureManager";
import { Reporters } from "./reporters";

/**
 * Create an object exposing well-known queries against our repo cohort
 * based on the fingerprints the given FeatureManager knows how to manage.
 * Return a query named "flagged" that shows any flagged fingerprints, across all repos.
 * Return 3 queries for each fingerprint name
 * 1. <fingerprintName>: Show distribution of the fingerprint
 * 2. <fingerprintName>-present: Is this fingerprint name present in this repo? Returns for all repos
 * 3. <fingerprintName>-ideal: Show progress toward the ideal for this fingerprint name
 */
export async function reportersAgainst(featureManager: FeatureManager,
                                       repos: HasFingerprints[] | AsyncIterable<HasFingerprints>): Promise<Reporters> {
    const reporters: Reporters = {};

    // Report bad fingerprints according to the FeatureManager
    reporters.flagged = params =>
        treeBuilderFor("flagged", params)
            .group({
                name: "flags",
                by: async a => {
                    const knownBad = (await Promise.all(
                        allFingerprints(a).map(fp => featureManager.flags(fp)),
                    )).filter(f => !!f && f.length > 0);
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        "-" + knownBad.length;
                },
            })
            .group({
                name: "violations",
                by: async a => {
                    const flags = await Promise.all(
                        allFingerprints(a).map(fp => featureManager.flags(fp)),
                    );
                    const knownBad: Flag[] = _.flatten(flags.filter(f => !!f && f.length > 0));
                    return knownBad.length === 0 ?
                        params.otherLabel :
                        knownBad.map(bad => bad.message).join(",");
                },
            })
            .renderWith(DefaultProjectAnalysisRenderer);

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
                    by: ar => {
                        const fp = ar.fingerprints[name];
                        return !!fp ? defaultedToDisplayableFingerprint(featureManager.featureFor(fp))(fp) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisRenderer);

        reporters[name + "-present"] = params =>
            treeBuilderFor(name, params)
                .group({
                    name,
                    by: ar => {
                        const fp = ar.fingerprints.find(fp => fp.name === name);
                        return !!fp ? "Yes" : "No";
                    },
                })
                .renderWith(DefaultProjectAnalysisRenderer);

        // Add a query that tells us how many repositories are on vs off the ideal, if any, for this fingerprint
        reporters[name + "-ideal"] = params =>
            treeBuilderFor(name, params)
                .group({
                    name: name + " ideal?",
                    by: async ar => {
                        const fp = ar.fingerprints.find(fp => fp.name === name);
                        const ideal = await featureManager.idealResolver(name);
                        if (!ideal.ideal) {
                            return !fp ? `Yes (gone)` : "No (present)";
                        }
                        if (!fp) {
                            return undefined;
                        }
                        const feature = featureManager.featureFor(fp);
                        if (ideal && ideal.ideal) {
                            return fp.sha === ideal.ideal.sha ? `Yes (${defaultedToDisplayableFingerprint(feature)(ideal.ideal)})` : "No";
                        }
                        return !!fp ? defaultedToDisplayableFingerprint(feature)(fp) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisRenderer);
    }

    return reporters;
}
