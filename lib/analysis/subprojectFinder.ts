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

import { Project } from "@atomist/automation-client";

/**
 * Subproject status
 */
export enum SubprojectStatus {
    /**
     * This is definitely NOT a monorepo
     */
    RootOnly = "RootOnly",
    /**
     * This is definitely a monorepo
     */
    IdentifiedPaths = "IdentifiedPaths",
    /**
     * The monorepo status of this repo cannot be determined
     */
    Unknown = "Unknown",
}

export interface SubprojectDescriptor {
    path: string;
    reason: string;
}

export interface Subprojects {
    status: SubprojectStatus;
    subprojects?: SubprojectDescriptor[];
}

export interface SubprojectFinder {
    name: string;
    findSubprojects: (project: Project) => Promise<Subprojects>;
}

/**
 * Return a subproject finder of all these
 * @param {SubprojectFinder} finders
 * @return {SubprojectFinder}
 */
export function firstSubprojectFinderOf(...finders: SubprojectFinder[]): SubprojectFinder {
    return {
        name: "Composite subproject finder",
        findSubprojects: async p => {
            const subprojects: SubprojectDescriptor[] = [];
            for (const finder of finders) {
                const r = await finder.findSubprojects(p);
                if (r.status === SubprojectStatus.RootOnly) {
                    return {
                        status: SubprojectStatus.RootOnly,
                    };
                }
                if (!!r.subprojects) {
                    subprojects.push(...r.subprojects);
                }
            }
            return {
                status: subprojects.length > 0 ? SubprojectStatus.IdentifiedPaths : SubprojectStatus.Unknown,
                subprojects,
            };
        },
    };
}
