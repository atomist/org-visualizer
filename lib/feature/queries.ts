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

import { SunburstTreeEmitter } from "../tree/TreeBuilder";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

export interface QueryParams {

    byOrg?: boolean;

    otherLabel?: string;

    /**
     * Path inside
     */
    path?: string;

    // tODO change to value
    artifact?: string;

    // TODO get rid of it
    list?: string;
}

export type Queries = Record<string, (params: QueryParams) => SunburstTreeEmitter<ProjectAnalysisResult>>;
