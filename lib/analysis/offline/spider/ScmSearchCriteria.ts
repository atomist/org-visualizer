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
 * Used to query GitHub
 */
export interface ScmSearchCriteria {

    /**
     * Query in GitHub terminology
     */
    githubQueries: string[];

    /**
     * Max number of repos to return
     */
    maxRetrieved: number;

    /**
     * Max number of repos to return
     */
    maxReturned: number;

    /**
     * Are we interested in persisting this project
     * @param {Project} p
     * @return {Promise<boolean>}
     */
    projectTest?: (p: Project) => Promise<boolean>;

}
