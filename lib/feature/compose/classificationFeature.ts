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
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import { Feature, sha256 } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";

/**
 * Knows how to classify projects into a unique String
 */
export interface Classifier {

    /**
     * Name of this classifier
     */
    readonly reason: string;

    /**
     * Classification this instance will return
     */
    readonly classification: string | string[];

    /**
     * Test for whether the given project meets this classification
     */
    predicate: (p: Project) => Promise<boolean>;
}

/**
 * Classify the project uniquely or otherwise
 * undefined to return no fingerprint
 * @return {Feature}
 */
export function classificationFeature(id: Pick<Feature, "name" | "displayName" | "toDisplayableFingerprintName"> & { allowMulti?: boolean },
                                      ...classifiers: Classifier[]): Feature {
    return {
        ...id,
        extract: async p => {
            const tags: string[] = [];
            for (const classifier of classifiers) {
                if (await classifier.predicate(p)) {
                    tags.push(...toArray(classifier.classification));
                    if (!id.allowMulti) {
                        break;
                    }
                }
            }
            const data = JSON.stringify(_.uniq(tags).sort());
            return !!tags ? {
                name: id.name,
                type: id.name,
                data,
                sha: sha256(data),
            } :
                undefined;
        },
        toDisplayableFingerprint: fp => JSON.parse(fp.data).join() || "unknown",
    };
}
