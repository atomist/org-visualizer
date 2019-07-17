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

import { Feature, sha256 } from "@atomist/sdm-pack-fingerprints";
import { sniffProject } from "./secretSniffing";
import { loadSnifferOptions } from "./snifferOptionsLoader";

const ExposedSecretsType = "exposed-secret";

export const ExposedSecrets: Feature = {
    name: ExposedSecretsType,
    displayName: "Exposed secrets",
    extract: async p => {
        const exposedSecretsResult = await sniffProject(p, await loadSnifferOptions());
        return exposedSecretsResult.exposedSecrets.map(es => {
            const data = {
                secret: es.secret,
                path: es.path,
                description: es.description,
            };
            return {
                type: ExposedSecretsType,
                name: ExposedSecretsType,
                data,
                sha: sha256(data),
            }
        })
    },
    toDisplayableFingerprintName: name => name,
    toDisplayableFingerprint: fp => `${fp.data.path}:${fp.data.description}`,
};
