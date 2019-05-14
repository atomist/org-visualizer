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
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";

export interface SubprojectDescription {
    path: string;
    reason: string;
    parentRepoRef: RemoteRepoRef;
}

/**
 * The result of running one analysis. Allows us to attach further information,
 * such as provenance if we spidered it.
 */
export interface ProjectAnalysisResult {

    readonly analysis: ProjectAnalysis;

    /**
     * Date of this analysis
     */
    readonly timestamp: Date;

    /**
     * If this is a project within a larger repo, describe that
     */
    readonly subproject?: SubprojectDescription;

}

export function isProjectAnalysisResult(r: any): r is ProjectAnalysisResult {
    const maybe = r as ProjectAnalysisResult;
    return !!maybe.analysis;
}
