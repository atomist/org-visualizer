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

import { projectUtils } from "@atomist/automation-client";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprint";
interface PythonVersionData {
    version: "2" | "3" | "indeterminate";
}

const PythonVersionAspectName = "PythonVersion";

export const PythonVersion: Aspect<PythonVersionData> = {
    name: PythonVersionAspectName,
    displayName: "Python 2 or 3",
    extract: async p => {

        const hasPython: boolean = await projectUtils.fileExists(p, "**/*.py");
        if (!hasPython) {
            return undefined;
        }

        const data: PythonVersionData = { version: "indeterminate" };
        return fingerprintOf({
            type: PythonVersionAspectName,
            name: "Python2or3",
            data,
        });
    },
};

// rod: promote this to fingerprint pack? I added uniquePartOfData
function fingerprintOf<DATA = any>(opts: {
    type: string,
    name?: string,
    data: DATA,
    uniquePartOfData?: (d: DATA) => Partial<DATA>,
}): FP<DATA> {
    const dataToSha = opts.uniquePartOfData ? opts.uniquePartOfData(opts.data) : opts.data;
    return {
        type: opts.type,
        name: opts.name || opts.type,
        data: opts.data,
        sha: sha256(JSON.stringify(dataToSha)),
    };
}
