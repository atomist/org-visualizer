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

import { Queries, treeBuilderFor } from "./queries";
import { HuckleberryManager } from "../huckleberry/HuckleberryManager";
import { DefaultProjectAnalysisResultRenderer } from "./projectAnalysisResultUtils";
import { TypeScriptVersionFeature } from "../huckleberry/TypeScriptVersionFeature";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

/**
 * Well known queries against our repo cohort
 */
export function huckleberryQueries(hm: HuckleberryManager): Queries {
    const queries: Queries = {};

    for (const huck of hm.huckleberries) {
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
    }

    console.log("Huckleberry queries=" + Object.getOwnPropertyNames(queries));
    return queries;
}


const huckleberryManager = new HuckleberryManager(
    new TypeScriptVersionFeature(),
    //new NodeLibraryVersionHuckleberry(new NodeLibraryVersion("@atomist/sdm", "2.0.0")),
    //bannedLibraryHuckleberry("axios"),
);

export interface DisplayableHuckleberry {
    name: string;
    readable: string;
    ideal?: string;
}

export const huckQueries = huckleberryQueries(huckleberryManager);

export async function presentHuckleberries(ar: ProjectAnalysisResult): Promise<DisplayableHuckleberry[]> {
    const hucksFound = await huckleberryManager.extract(ar.analysis);
    return hucksFound.map(huck => {
        const instance = ar.analysis.fingerprints[huck.name];
        // TODO check if it has a ideal before attempting to compute it
        return {
            name: huck.name,
            readable: huck.toDisplayableString(instance),
            // ideal: huck.toDisplayableString(huck.ideal),
        };
    });
}

export async function possibleHuckleberries(ar: ProjectAnalysisResult): Promise<DisplayableHuckleberry[]> {
    //const i = analy
    const hucksFound = await huckleberryManager.growable(ar.analysis);
    return hucksFound.map(huck => {
        // TODO check if it has a ideal
        return {
            name: huck.name,
            readable: "Absent",
            //ideal: huck.toDisplayableString(huck.ideal),
        };
    });
}



