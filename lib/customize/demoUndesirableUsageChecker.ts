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

import { NpmDeps } from "@atomist/sdm-pack-fingerprints";
import { TypeScriptVersionType } from "../aspect/node/TypeScriptVersion";
import { chainUndesirableUsageCheckers } from "../aspect/ProblemStore";

/**
 * Demonstration of code-driven flagging of undesirable uses
 * @type {UndesirableUsageChecker}
 */
export const demoUndesirableUsageChecker = chainUndesirableUsageCheckers(
    fingerprint => fingerprint.type === TypeScriptVersionType && fingerprint.name === TypeScriptVersionType
        && fingerprint.data.some(v => v.startsWith("2")) ?
        {
            severity: "warn",
            authority: "Rod",
            description: "Old TypeScript",
            fingerprint,
        } :
        undefined,
    fingerprint => fingerprint.type === NpmDeps.name && fingerprint.name === "axios" ?
        {
            severity: "warn",
            authority: "Christian",
            description: "Don't use Axios",
            fingerprint,
        } :
        undefined,
    fingerprint => fingerprint.type === NpmDeps.name &&
        fingerprint.data[1].length > "15" ?
        {
            severity: "warn",
            authority: "Rod",
            description: "Pre-release npm",
            fingerprint,
        } :
        undefined,
    fingerprint => {
        if (fingerprint.type === "tslintproperty" && fingerprint.name === "rules:max-file-line-count") {
            try {
                const obj = JSON.parse(fingerprint.data);
                if (obj.options && obj.options.some(parseInt) > 500) {
                    return {
                        severity: "warn",
                        authority: "Rod",
                        description: "Allow long files",
                        fingerprint,
                    };
                }
            } catch {
                // Do nothing
            }
        }
        return undefined;
    });
