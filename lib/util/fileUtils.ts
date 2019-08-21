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

/**
 * Return the first file found of the given paths
 * @param {Project} p
 * @param {string} paths
 * @return {Promise<File | undefined>}
 */
export async function firstFileFound(p: Project, ...paths: string[]): Promise<ProjectFile | undefined> {
    for (const path of paths) {
        const f = await p.getFile(path);
        if (f) {
            return f;
        }
    }
    return undefined;
}
