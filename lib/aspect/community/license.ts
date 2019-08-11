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

import {
    Project,
    ProjectFile,
} from "@atomist/automation-client";
import {
    Aspect, FP,
    sha256,
} from "@atomist/sdm-pack-fingerprints";

export const NoLicense = "None";

export const LicenseType = "license";

export function hasNoLicense(ld: LicenseData): boolean {
    return ld.classification === NoLicense;
}

export function isLicenseFingerprint(fp: FP): fp is FP<LicenseData> {
    const maybe = fp as FP<LicenseData>;
    return fp.type === LicenseType && !!maybe.data.classification;
}

export interface LicenseData {
    path: string;

    /**
     * What we've classified the license as by parsing the license file.
     */
    classification: string;

    content?: string;
}

/**
 * License aspect. Every repository gets a license fingerprint, which may have unknown
 * as a license.
 */
export const License: Aspect<FP<LicenseData>> = {
    name: LicenseType,
    displayName: "License",
    baseOnly: true,
    extract: async p => {
        const licenseFile = await firstFileFound(p, "LICENSE", "LICENSE.txt", "license.txt", "LICENSE.md");
        let classification: string = NoLicense;
        let content: string;
        if (!!licenseFile) {
            content = await licenseFile.getContent();
            classification = content.trim().split("\n")[0].trim();
        }
        const data: LicenseData = { classification, content, path: licenseFile ? licenseFile.path : undefined };
        return {
            type: LicenseType,
            name: LicenseType,
            data,
            sha: sha256(JSON.stringify(data)),
        };
    },
    toDisplayableFingerprintName: () => "License",
    toDisplayableFingerprint: fp => {
        return fp.data.classification === NoLicense ?
            "None" :
            `${fp.data.path}:${fp.data.classification}`;
    },
};

async function firstFileFound(p: Project, ...paths: string[]): Promise<ProjectFile | undefined> {
    for (const path of paths) {
        const f = await p.getFile(path);
        if (f) {
            return f;
        }
    }
    return undefined;
}
