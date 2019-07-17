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
    path: string;
    classification: string;
    content?: string;
}

export const License: Feature = {
    name: "license",
    displayName: "License",
    extract: async p => {
        let path;
        let licenseFile = await p.getFile("LICENSE");
        if (!!licenseFile) {
            path = "LICENSE";
        } else {
            licenseFile = await p.getFile("LICENSE.txt");
            if (!!licenseFile) {
                path = "LICENSE.txt";
            }
        }
        let classification: string = "None";
        let content: string;
        if (!!licenseFile) {
            content = await licenseFile.getContent();
            classification = content.trim().split("\n")[0].trim();
        }
        const data: LicenseData = { classification, content, path };
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
            return (!!fp.data && !!fp.data.classification) ? `${fp.data.path}:${fp.data.classification}` : "None";
        } catch (err) {
            return "Unknown";
        }
    },
};
