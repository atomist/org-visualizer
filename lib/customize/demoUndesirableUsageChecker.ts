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
import { chainUndesirableUsageCheckers } from "../feature/AspectRegistry";
import { TypeScriptVersionType } from "../feature/node/TypeScriptVersion";

/**
 * Demonstration of code-driven flagging of undesirable uses
 * @type {UndesirableUsageChecker}
 */
export const demoUndesirableUsageChecker = chainUndesirableUsageCheckers(
    async (wsid, fp) => fp.type === TypeScriptVersionType && fp.name === TypeScriptVersionType
        && fp.data.some(v => v.startsWith("2")) ?
        {
            severity: "warn",
            authority: "Rod",
            message: "Old TypeScript",
        } :
        undefined,
    async (wsid, fp) => fp.type === NpmDeps.name && fp.name === "axios" ?
        {
            severity: "warn",
            authority: "Christian",
            message: "Axios",
        } :
        undefined,
    async (wsid, fp) => fp.type === NpmDeps.name &&
        fp.data[1].length > "15" ?
        {
            severity: "warn",
            authority: "Rod",
            message: "Pre-release npm",
        } :
        undefined,
    async (wsid, fp) => {
        if (fp.type === "tslintproperty" && fp.name === "rules:max-file-line-count") {
            try {
                const obj = JSON.parse(fp.data);
                if (obj.options && obj.options.some(parseInt) > 500) {
                    return {
                        severity: "warn",
                        authority: "Rod",
                        message: "Allow long files",
                    };
                }
            } catch {
                // Do nothing
            }
        }
        return undefined;
    });
