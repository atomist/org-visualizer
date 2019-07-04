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

import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { DerivedFeature, Feature, sha256 } from "@atomist/sdm-pack-fingerprints";

import * as _ from "lodash";

/**
 * Function or path within ProjectAnalysis structure
 */
export type Extractor = ((pa: ProjectAnalysis) => any) | string;

export function assembledFeature(
    opts: Pick<Feature, "name" | "displayName" | "toDisplayableFingerprint" | "toDisplayableFingerprintName">,
    ...extractors: Extractor[]): DerivedFeature<ProjectAnalysis> {
    return {
        ...opts,
        derive: async pa => {
            const qualifyingPathValues = [];
            for (const extractor of extractors) {
                const value = applyExtractor(extractor, pa);
                if (!!value) {
                    qualifyingPathValues.push(value);
                }
            }
            return qualifyingPathValues.length > 0 ?
                {
                    name: opts.name,
                    abbreviation: opts.name,
                    version: "0.1.0",
                    data: qualifyingPathValues,
                    sha: sha256(JSON.stringify(qualifyingPathValues)),
                } :
                undefined;
        },
        apply: undefined,
    };
}

function applyExtractor(extractor: Extractor, pa: ProjectAnalysis): any {
    return typeof extractor === "string" ?
        _.get(pa, extractor) :
        extractor(pa);
}

/**
 * Composite feature
 */
export function featureOf(
    opts: Pick<Feature, "name" | "displayName" | "toDisplayableFingerprint" | "toDisplayableFingerprintName">,
    ...features: Feature[]): Feature {
    return {
        ...opts,
        extract: async p => {
            const qualifyingPathValues = [];
            for (const feature of features) {
                const value = feature.extract(p);
                if (!!value) {
                    qualifyingPathValues.push(value);
                }
            }
            return qualifyingPathValues.length > 0 ?
                {
                    name,
                    abbreviation: name,
                    version: "0.1.0",
                    data: qualifyingPathValues,
                    sha: sha256(JSON.stringify(qualifyingPathValues)),
                } :
                undefined;
        },
        apply: undefined,
    };
}
