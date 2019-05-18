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
    Queries,
    treeBuilderFor,
} from "./queries";
import { DefaultProjectAnalysisResultRenderer } from "./projectAnalysisResultUtils";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { Eliminate, FeatureManager, isDistinctIdeal } from "../feature/FeatureManager";
import { featureManager } from "./features";

/**
 * Well known queries against our repo cohort
 */
export function featureQueriesFrom(hm: FeatureManager): Queries {
    const queries: Queries = {};

    for (const huck of hm.features) {
        queries[huck.name] = params =>
            // TODO better name?
            treeBuilderFor(huck.name, params)
                .group({
                    name: huck.name,
                    by: ar => {
                        const hi = ar.analysis.fingerprints[huck.name];
                        return !!hi ? huck.toDisplayableString(hi) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisResultRenderer);

        queries[huck.name + "-ideal"] = params =>
            // TODO better name?
            treeBuilderFor(huck.name, params)
                .group({
                    name: huck.name + " ideal?",
                    by: async ar => {
                        const hi = ar.analysis.fingerprints[huck.name];
                        const ideal = await featureManager.ideal(huck.name);
                        if (ideal === "eliminate") {
                            return !hi ? `Yes (gone)` : "No (present)";
                        }
                        if (!hi) {
                            return undefined;
                        }

                        if (ideal && isDistinctIdeal(ideal)) {
                            console.log(`We have ${hi.sha} they have ${ideal.sha}`);
                            return hi.sha === ideal.sha ? `Yes (${huck.toDisplayableString(ideal)})` : "No";
                        }
                        return !!hi ? huck.toDisplayableString(hi) : undefined;
                    },
                })
                .renderWith(DefaultProjectAnalysisResultRenderer);
    }

    console.log("Huckleberry queries=" + Object.getOwnPropertyNames(queries));
    return queries;
}



export interface DisplayableFeature {
    name: string;
    readable: string;
    ideal?: string;
}

export async function featuresFound(fm: FeatureManager, ar: ProjectAnalysisResult): Promise<DisplayableFeature[]> {
    const hucksFound = await fm.featuresFound(ar.analysis);
    const results: DisplayableFeature[] = [];
    for (const huck of hucksFound) {
        const instance = ar.analysis.fingerprints[huck.name];
        const hideal = await fm.ideal(huck.name);
        results.push({
            name: huck.name,
            readable: huck.toDisplayableString(instance),
            ideal: isDistinctIdeal(hideal) ? huck.toDisplayableString(hideal) : undefined,
        });
    }
    return results;
}

export async function possibleFeaturesNotFound(fm: FeatureManager, ar: ProjectAnalysisResult): Promise<DisplayableFeature[]> {
    const hucksFound = await fm.possibleFeaturesNotFound(ar.analysis);
    const necessaryNotFound = await fm.necessaryFeaturesNotFound(ar.analysis);
    const results: DisplayableFeature[] = [];
    for (const huck of hucksFound.filter(h => !necessaryNotFound.some(n => n.name === h.name))) {
        const hideal = await fm.ideal(huck.name);
        results.push({
            name: huck.name,
            readable: "None",
            ideal: isDistinctIdeal(hideal) ? huck.toDisplayableString(hideal) : undefined,
        });
    }
    return results;
}

export async function necessaryFeaturesNotFound(fm: FeatureManager, ar: ProjectAnalysisResult): Promise<DisplayableFeature[]> {
    const hucksFound = await fm.necessaryFeaturesNotFound(ar.analysis);
    const results: DisplayableFeature[] = [];
    for (const huck of hucksFound) {
        const hideal = await fm.ideal(huck.name);
        results.push({
            name: huck.name,
            readable: "None",
            ideal: isDistinctIdeal(hideal) ? huck.toDisplayableString(hideal) : undefined,
        });
    }
    return results;
}



