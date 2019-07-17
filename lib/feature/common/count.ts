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

import { LocalProject } from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import {
    Feature,
    sha256,
} from "@atomist/sdm-pack-fingerprints";

/**
 * Size in terms of files
 */
export const fileCountFeature: Feature = {
    name: "size",
    // Display name is undefined to prevent display
    displayName: undefined,
    extract: async p => {
        const data = await p.totalFileCount() + "";
        return {
            type: "size",
            name: "size",
            data,
            sha: sha256(data),
        };
    },
    toDisplayableFingerprint: fp => fp.data,
    toDisplayableFingerprintName: () => "size",
};

export const branchCount: Feature = {
    name: "branches",
    displayName: "Branch count",
    extract: async p => {
        const lp = p as LocalProject;
        const bp = await execPromise("git", ["branch", "-a"], {
            cwd: lp.baseDir,
        });
        const brCount = bp.stdout.split("\n").length;
        const data = brCount + "";
        return {
            type: "branches",
            name: "branches",
            data,
            sha: sha256(data),
        };
    },
    toDisplayableFingerprintName: () => "branch count",
    toDisplayableFingerprint: fp => {
        const count = parseInt(fp.data, 10);
        if (count > 20) {
            return "crazy (>20)";
        }
        if (count > 12) {
            return "excessive (12-20)";
        }
        if (count > 5) {
            return "high (5-12)";
        }
        return "ok (<=5)";
    },

};
