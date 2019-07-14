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

import { Feature, sha256, TypedFP } from "@atomist/sdm-pack-fingerprints";

export interface LicenseData {
    classification: string;
    content?: string;
}

export const License: Feature = {
    name: "license",
    displayName: "License",
    extract: async p => {
        const licenseFile = await p.getFile("LICENSE");
        let classification: string;
        let content: string;
        if (!licenseFile) {
            classification = "None";
        } else {
            content = await licenseFile.getContent();
            classification = content.split("\n")[0].trim();
        }
        const data: LicenseData = { classification, content };
        return {
            type: "license",
            name: "license",
            data,
            sha: sha256(JSON.stringify(data)),
        };
    },
    toDisplayableFingerprintName: () => "License",
    toDisplayableFingerprint: fp => {
        try {
            const d = JSON.parse(fp.data) as LicenseData;
            return d.classification || "None";
        } catch (err) {
            return "Unknown";
        }
    },
};
