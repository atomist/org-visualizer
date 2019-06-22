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

import { Project } from "@atomist/automation-client";
import { Feature, sha256 } from "@atomist/sdm-pack-fingerprints";

export interface Classifier {
    classification: string;
    predicate: (p: Project) => Promise<boolean>;
}

/**
 *
 * @param {Pick<Feature, "name" | "displayName"> & {fallbackClassification?: string}} id Fallback classification can be
 * undefined to return no fingerprint
 * @param {Classifier} classifiers
 * @return {Feature}
 */
export function classifyFeature(id: Pick<Feature, "name" | "displayName"> & { fallbackClassification: string },
                                ...classifiers: Classifier[]): Feature {
    return {
        ...id,
        extract: async p => {
            let data = id.fallbackClassification;
            for (const classifier of classifiers) {
                if (await classifier.predicate(p)) {
                    data = classifier.classification;
                    break;
                }
            }
            return !!data ? {
                    name: id.name,
                    type: id.name,
                    data,
                    sha: sha256(data),
                } :
                undefined;
        },
        selector: fp => fp.name === id.name,

    };
}
