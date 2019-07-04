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
import { DerivedFeature, Feature, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { allFingerprints } from "../DefaultFeatureManager";
import { HasFingerprints } from "../FeatureManager";

// TODO move to fingerprints pack

/**
 * Feature that is satisfied by at least one of these fingerprints.
 * For example, is there CI? This may be satisfied by a
 * Jenkins, Circle or Travis fingerprint.
 * Such features are not applicable.
 * @param opts feature fields
 * @param names fingerprint names
 * @return {Feature}
 */
export function oneOf(
    opts: Pick<Feature, "name" | "displayName" | "toDisplayableFingerprint" | "toDisplayableFingerprintName">,
    ...names: string[]): DerivedFeature<HasFingerprints> {
    return {
        ...opts,
        derive: async hf => {
            const qualifyingFingerprints: FP[] = [];
            for (const fp of allFingerprints(hf)) {
                if (names.includes(fp.name)) {
                    qualifyingFingerprints.push(fp);
                }
            }
            return qualifyingFingerprints.length > 0 ?
                {
                    name,
                    abbreviation: name,
                    version: "0.1.0",
                    data: qualifyingFingerprints,
                    sha: sha256(JSON.stringify(qualifyingFingerprints)),
                } :
                undefined;
        },
        apply: undefined,
    };
}

/**
 * Make this feature conditional
 * @return {Feature}
 */
export function conditionalize(f: Feature,
                               details: Pick<Feature, "name" | "displayName" |
        "toDisplayableFingerprint" | "toDisplayableFingerprintName">,
                               test: (p: Project) => Promise<boolean>): Feature {
    return {
        ...f,
        ...details,
        extract: async p => {
            const testResult = await test(p);
            return testResult ?
                f.extract(p) :
                undefined;
        },
    };
}
