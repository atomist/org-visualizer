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

import { logger } from "@atomist/automation-client";
import { loadUserConfiguration } from "@atomist/automation-client/lib/configuration";
import { StableDirectoryManager } from "@atomist/automation-client/lib/spi/clone/StableDirectoryManager";
import { TmpDirectoryManager } from "@atomist/automation-client/lib/spi/clone/tmpDirectoryManager";
import _ = require("lodash");
import {
    Aspects,
    virtualProjectFinder,
} from "../../../customize/aspects";
import {
    createAnalyzer,
    sdmConfigClientFactory,
} from "../../../machine/machine";
import { PostgresProjectAnalysisResultStore } from "../persist/PostgresProjectAnalysisResultStore";
import { GitCommandGitProjectCloner } from "./github/GitCommandGitProjectCloner";
import { GitHubSpider } from "./github/GitHubSpider";
import { LocalSpider } from "./local/LocalSpider";
import { ScmSearchCriteria } from "./ScmSearchCriteria";
import {
    Spider,
    SpiderResult,
} from "./Spider";

export interface SpiderAppOptions {

    source: "GitHub" | "local";

    localDirectory?: string;

    owner?: string;

    /**
     * If this is set, clone under this directory on the local drive
     */
    cloneUnder?: string;

    /**
     * Refine name in GitHub search if searching for repos
     */
    search?: string;

    /**
     * If this is supplied, run a custom GitHub query
     */
    query?: string;

    workspaceId: string;

    /**
     * Update existing analyses for the same sha?
     * Take care to set this to false if the spider code has been updated
     */
    update?: boolean;
}

/**
 * Spider a GitHub.com org
 */
export async function spider(params: SpiderAppOptions): Promise<SpiderResult> {
    const { search, workspaceId } = params;
    const analyzer = createAnalyzer(Aspects, virtualProjectFinder);
    const org = params.owner;
    const searchInRepoName = search ? ` ${search} in:name` : "";

    const spiderYo: Spider = params.source === "GitHub" ?
        new GitHubSpider(params.cloneUnder ?
            new GitCommandGitProjectCloner(new StableDirectoryManager({
                baseDir: params.cloneUnder,
                cleanOnExit: false,
                // Use previous clones if possible
                reuseDirectories: true,
            })) :
            new GitCommandGitProjectCloner(TmpDirectoryManager)) :
        new LocalSpider(params.localDirectory);
    const persister = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory(loadUserConfiguration()));
    const query = params.query || `org:${org}` + searchInRepoName;

    const criteria: ScmSearchCriteria = {
        // See the GitHub search API documentation at
        // https://developer.github.com/v3/search/
        // You can query for many other things here, beyond org
        githubQueries: [query],

        maxRetrieved: 1500,
        maxReturned: 1500,
        projectTest: async p => {
            // You can also perform a computation here to return false if a project should not
            // be analyzed and persisted, based on its contents. For example,
            // this enables you to analyze only projects containing a particular file
            // through calling getFile()
            return true;
        },
    };

    const arr = new Array<string>(JSON.stringify(criteria).length + 20);
    _.fill(arr, "-");
    const sep = arr.join("");
    logger.debug("%s\nOptions: %j\nSpider criteria: %j\n%s\n", sep, params, criteria, sep);
    return spiderYo.spider(criteria,
        analyzer,
        {
            persister,
            keepExistingPersisted: async existing => {
                // Perform a computation here to return true if an existing analysis seems valid
                const keep = !params.update;
                logger.debug(keep ?
                    `Retaining existing analysis for ${existing.analysis.id.url}:${existing.analysis.id.sha}` :
                    `Recomputing analysis for ${existing.analysis.id.url}:${existing.analysis.id.sha}`);
                return keep;
            },
            // Controls promise usage in Node
            poolSize: 40,
            workspaceId,
        });
}
