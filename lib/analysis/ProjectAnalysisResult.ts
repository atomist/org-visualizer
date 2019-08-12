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

import { RemoteRepoRef } from "@atomist/automation-client";
import { Analyzed } from "../aspect/AspectRegistry";

/**
 * The result of running one analysis. Allows us to attach further information,
 * such as provenance if we spidered it.
 */
export interface ProjectAnalysisResult {

    /**
     * Unique database id. Available after persistence.
     */
    readonly id?: string;

    readonly repoRef: RemoteRepoRef;

    readonly workspaceId: string;

    /**
     * If this is a deep retrieval, analysis
     */
    readonly analysis?: Analyzed;

    /**
     * Date of this analysis
     */
    readonly timestamp: Date;

}

export function isProjectAnalysisResult(r: any): r is ProjectAnalysisResult {
    const maybe = r as ProjectAnalysisResult;
    return !!maybe.repoRef && !!maybe.timestamp;
}
