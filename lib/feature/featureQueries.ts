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

import { featureManager } from "../routes/features";
import {
    treeBuilderFor,
} from "../routes/wellKnownQueries";
import {
    FeatureManager,
    HasFingerprints,
} from "./FeatureManager";
import { DefaultProjectAnalysisRenderer } from "./support/groupingUtils";

import * as _ from "lodash";
import {
    allFingerprints,
    defaultedToDisplayableFingerprint,
} from "./DefaultFeatureManager";
import { Reporters } from "./reporters";

/**
 * Create an object exposing well-known queries against our repo cohort
 * based on the fingerprints the given FeatureManager knows how to manage.
 * Return 2 queries for each fingerprint name
 * 1. <fingerprintName>: Show distribution of the fingerprint
 * 2. <fingerprintName>-ideal: Show progress toward the ideal for this fingerprint name
 */
export function featureQueriesFrom(hm: FeatureManager, repos: HasFingerprints[]): Reporters {
    const queries: Reporters = {};

    const fingerprintNames = _.uniq(allFingerprints(repos).map(fp => fp.name));
    for (const name of fingerprintNames) {
        queries[name] = params =>
            treeBuilderFor(name, params)
                .group({
                    name,
                    by: ar => {
                        const fp = ar.fingerprints[name];
                        return !!fp ? defaultedToDisplayableFingerprint(hm.featureFor(fp))(fp) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisRenderer);

        // Add a query that tells us how many repositories are on vs off the ideal, if any, for this fingerprint
        queries[name + "-ideal"] = params =>
            treeBuilderFor(name, params)
                .group({
                    name: name + " ideal?",
                    by: async ar => {
                        const fp = ar.fingerprints[name];
                        const ideal = await featureManager.idealResolver(name);
                        if (!ideal.ideal) {
                            return !fp ? `Yes (gone)` : "No (present)";
                        }
                        if (!fp) {
                            return undefined;
                        }
                        const feature = hm.featureFor(fp);
                        if (ideal && ideal.ideal) {
                            return fp.sha === ideal.ideal.sha ? `Yes (${defaultedToDisplayableFingerprint(feature)(ideal.ideal)})` : "No";
                        }
                        return !!fp ? defaultedToDisplayableFingerprint(feature)(fp) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisRenderer);
    }

    return queries;
}

export interface DisplayableFingerprint {
    name: string;
    readable: string;
    ideal?: string;
}

export async function fingerprintsFound(fm: FeatureManager, ar: HasFingerprints): Promise<DisplayableFingerprint[]> {
    const results: DisplayableFingerprint[] = [];
    const fingerprints = allFingerprints(ar);
    for (const instance of fingerprints) {
        const hideal = await fm.idealResolver(instance.name);
        const huck = fm.featureFor(instance);
        if (huck) {
            results.push({
                name: instance.name,
                readable: defaultedToDisplayableFingerprint(huck)(instance),
                ideal: defaultedToDisplayableFingerprint(huck)(hideal.ideal),
            });
        }
    }
    return results;
}
