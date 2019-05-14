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

import * as _ from "lodash";
import * as path from "path";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { Renderer } from "../tree/TreeBuilder";

export type ProjectAnalysisResultGrouper = (ar: ProjectAnalysisResult) => string;

export const OrgGrouper: ProjectAnalysisResultGrouper = a => _.get(a, "analysis.id.owner");

export const DefaultProjectAnalysisResultRenderer: Renderer<ProjectAnalysisResult> =
    ar => {
        const projectName = ar.analysis.id.path ?
            ar.analysis.id.repo + path.sep + ar.analysis.id.path :
            ar.analysis.id.repo;
        const url = ar.analysis.id.path ?
            ar.analysis.id.url + "/tree/" + (ar.analysis.id.sha || "master") + "/" + ar.analysis.id.path :
            ar.analysis.id.url;

        return {
            name: projectName,
            size: 1,
            url,
            repoUrl: ar.analysis.id.url,
        };
    };
