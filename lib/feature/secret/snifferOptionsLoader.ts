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

import { SecretDefinition, SnifferOptions } from "./secretSniffing";

import * as yaml from "yamljs";

import { AllFiles } from "@atomist/automation-client";
import * as fs from "fs";
import * as path from "path";

/**
 * Based on regular expressions in https://www.ndss-symposium.org/wp-content/uploads/2019/02/ndss2019_04B-3_Meli_paper.pdf
 * @type {any[]}
 */
export async function loadSnifferOptions(): Promise<SnifferOptions> {
    const secretsYmlPath = path.join(__dirname, "..", "..", "..", "secrets.yml");
    const yamlString = fs.readFileSync(secretsYmlPath, "utf8");
    try {
        const native = await yaml.parse(yamlString);

        const secretDefinitions: SecretDefinition[] = native.secrets
            .map((s: any) => s.secret)
            .map((s: any) => ({
                pattern: new RegExp(s.pattern, "g"),
                description: s.description,
            }));

        return {
            secretDefinitions,
            whitelist: native.whitelist || [],
            globs: native.globs || [AllFiles],
            scanOnlyChangedFiles: native.scanOnlyChangedFiles || false,
        };
    } catch (err) {
        throw new Error(`Unable to parse secrets.yml: ${err.message}`);
    }
}
