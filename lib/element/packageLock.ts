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
    TechnologyElement,
    TechnologyScanner,
} from "@atomist/sdm-pack-analysis";

/**
 * Information extracted from package-lock.json files.
 */
export interface PackageLock extends TechnologyElement {

    packageLock: {
        dependencies: Record<string, {
            version: string;
        }>,
    };

}

/**
 * Scan package lock files
 * @param {Project} p
 * @return {Promise<any>}
 */
export const packageLockScanner: TechnologyScanner<PackageLock> = async p => {
    const pl = await p.getFile("package-lock.json");
    if (!pl) {
        return undefined;
    }
    return {
        name: "packageLock",
        packageLock: JSON.parse(await pl.getContent()),
        tags: [],
    };
};
