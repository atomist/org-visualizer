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

import { Aspect, sha256 } from "@atomist/sdm-pack-fingerprints";

const FileCountType = "fileCount";

/**
 * Size in terms of files
 */
export const fileCount: Aspect = {
    name: FileCountType,
    displayName: "File count",
    extract: async p => {
        const data = { count: await p.totalFileCount() };
        return {
            type: FileCountType,
            name: FileCountType,
            data,
            sha: sha256(JSON.stringify(data)),
        };
    },
    toDisplayableFingerprint: fp => band(parseInt(fp.data, 10)),
    toDisplayableFingerprintName: () => "file count",
    stats: {
        defaultStatStatus: {
            entropy: false,
        },
        basicStatsPath: "count",
    },
};

const band = (count: number) => {
    if (count > 20000) {
        return "venti";
    }
    if (count > 5000) {
        return "grande";
    }
    if (count > 1000) {
        return "tall";
    }
    return "small";
};
