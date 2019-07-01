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

import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import * as _ from "lodash";
import * as path from "path";
import { Renderer } from "../../tree/TreeBuilder";
import { Analyzed } from "../FeatureManager";

export type AnalyzedGrouper = (ar: Analyzed) => string;

export type ProjectAnalysisGrouper = (ar: ProjectAnalysis) => string;

export const OrgGrouper: AnalyzedGrouper = a => _.get(a, "id.owner");

export const DefaultAnalyzedRenderer: Renderer<Analyzed> =
    ar => {
        const projectName = ar.id.path ?
            ar.id.repo + path.sep + ar.id.path :
            ar.id.repo;
        const url = ar.id.path ?
            ar.id.url + "/tree/" + (ar.id.sha || "master") + "/" + ar.id.path :
            ar.id.url;

        return {
            name: projectName,
            size: 1,
            url,
            repoUrl: ar.id.url,
        };
    };
