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

import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import {
    FeatureManager,
} from "../feature/FeatureManager";
import { featureManager } from "./features";
import { DefaultProjectAnalysisResultRenderer } from "./projectAnalysisResultUtils";
import {
    Queries,
    treeBuilderFor,
} from "./queries";

import { ConsolidatedFingerprints } from "@atomist/sdm-pack-analysis/lib/analysis/ProjectAnalysis";
import * as _ from "lodash";
import { allFingerprints } from "../feature/DefaultFeatureManager";

export interface HasFingerprints {
    fingerprints: ConsolidatedFingerprints;
}

/**
 * Well known queries against our repo cohort
 */
export function featureQueriesFrom(hm: FeatureManager, repos: HasFingerprints[]): Queries {
    const queries: Queries = {};

    const fingerprintNames = _.uniq(allFingerprints(repos).map(fp => fp.name));
    for (const name of fingerprintNames) {
        queries[name] = params =>
            treeBuilderFor(name, params)
                .group({
                    name,
                    by: ar => {
                        const fp = ar.analysis.fingerprints[name];
                        const feature = hm.featureFor(fp);
                        const toDisplayableFingerprint = (feature && feature.toDisplayableFingerprint) || (fp => fp.data);
                        return !!fp ? toDisplayableFingerprint(fp) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisResultRenderer);

        queries[name + "-ideal"] = params =>
            treeBuilderFor(name, params)
                .group({
                    name: name + " ideal?",
                    by: async ar => {
                        const fp = ar.analysis.fingerprints[name];
                        const ideal = await featureManager.idealResolver(name);
                        if (!ideal.ideal) {
                            return !fp ? `Yes (gone)` : "No (present)";
                        }
                        if (!fp) {
                            return undefined;
                        }
                        const feature = hm.featureFor(fp);
                        const toDisplayableFingerprint = feature.toDisplayableFingerprint || (fp => fp.data);
                        if (ideal && ideal.ideal) {
                            console.log(`We have ${fp.sha} they have ${ideal.ideal.sha}`);
                            return fp.sha === ideal.ideal.sha ? `Yes (${toDisplayableFingerprint(ideal.ideal)})` : "No";
                        }
                        return !!fp ? feature.toDisplayableFingerprint(fp) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisResultRenderer);
    }

    return queries;
}

export interface DisplayableFingerprint {
    name: string;
    readable: string;
    ideal?: string;
}

export async function fingerprintsFound(fm: FeatureManager, ar: ProjectAnalysisResult): Promise<DisplayableFingerprint[]> {
    const results: DisplayableFingerprint[] = [];
    const fingerprints = allFingerprints(ar.analysis);
    for (const instance of fingerprints) {
        const hideal = await fm.idealResolver(instance.name);
        const huck = fm.featureFor(instance);
        if (huck) {
            const toDisplayableFingerprint = huck.toDisplayableFingerprint || (fp => fp.data);
            results.push({
                name: instance.name,
                readable: toDisplayableFingerprint(instance),
                ideal: hideal.ideal ? huck.toDisplayableFingerprint(hideal.ideal) : undefined,
            });
        }
    }
    return results;
}

/*
export async function possibleFingerprintsNotFound(fm: FeatureManager, ar: ProjectAnalysisResult): Promise<DisplayableFingerprint[]> {
    const hucksFound = await fm.possibleFeaturesNotFound(ar.analysis);
    const necessaryNotFound = await fm.necessaryFeaturesNotFound(ar.analysis);
    const results: DisplayableFingerprint[] = [];
    for (const huck of hucksFound.filter(h => !necessaryNotFound.some(n => n.name === h.name))) {
        const hideal = await fm.idealResolver(huck.name);
        results.push({
            name: huck.name,
            readable: "None",
            ideal: isDistinctIdeal(hideal) ? huck.toDisplayableString(hideal) : undefined,
        });
    }
    return results;
}

export async function necessaryFingerprintsNotFound(fm: FeatureManager, ar: ProjectAnalysisResult): Promise<DisplayableFingerprint[]> {
    const hucksFound = await fm.necessaryFeaturesNotFound(ar.analysis);
    const results: DisplayableFingerprint[] = [];
    for (const huck of hucksFound) {
        const hideal = await fm.idealResolver(huck.name);
        results.push({
            name: huck.name,
            readable: "None",
            ideal: isDistinctIdeal(hideal) ? huck.toDisplayableString(hideal) : undefined,
        });
    }
    return results;
}

*/
