#!/usr/bin/env node
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

// tslint:disable

/**
 * Main entry point script. Added as a binary in package.json
 */

import { GitHubSpider } from "../analysis/offline/spider/github/GitHubSpider";
import { Spider } from "../analysis/offline/spider/Spider";
import { createAnalyzer } from "../machine/machine";
import {
    configureLogging,
    MinimalLogging,
} from "@atomist/automation-client";
import { firstSubprojectFinderOf } from "../analysis/subprojectFinder";
import { fileNamesSubprojectFinder } from "../analysis/fileNamesSubprojectFinder";
import * as yargs from "yargs";
import { PostgresProjectAnalysisResultStore } from "../analysis/offline/persist/PostgresProjectAnalysisResultStore";

import { Client } from "pg";

// Ensure we see console logging, and send info to the console
configureLogging(MinimalLogging);

process.on('uncaughtException', function (err) {
    console.log(err);
    process.exit(1);
});

interface SpiderOptions {
    owner: string;

    /**
     * Refine name in GitHub search if searching for repos
     */
    search?: string;

    /**
     * If this is supplied, run a custom GitHub query
     */
    query?: string;
}

/**
 * Spider a GitHub.com org
 */
async function spider(params: SpiderOptions) {
    const analyzer = createAnalyzer(undefined);
    const org = params.owner;
    const searchInRepoName = search ? ` ${search} in:name` : "";

    const spider: Spider = new GitHubSpider();
    const persister = //new FileSystemProjectAnalysisResultStore();
        new PostgresProjectAnalysisResultStore(() => new Client({
            database: "org_viz",
        }));
    const query = params.query || `org:${org}` + searchInRepoName;

    const result = await spider.spider({
            // See the GitHub search API documentation at
            // https://developer.github.com/v3/search/
            // You can query for many other things here, beyond org
            githubQueries: [query],

            maxRetrieved: 1500,
            maxReturned: 1500,
            projectTest: async p => {
                // Perform a computation here to return false if a project should not
                // be analyzed and persisted, based on its contents. For example,
                // this enables you to analyze only projects containing a particular file
                // through calling getFile()
                return true;
            },
            subprojectFinder: firstSubprojectFinderOf(
                fileNamesSubprojectFinder("pom.xml", "build.gradle", "package.json"),
            ),
        },
        analyzer,
        {
            persister,
            keepExistingPersisted: async existing => {
                console.log(`\tAnalyzing ${existing.analysis.id.url}`);

                // Perform a computation here to return true if an existing analysis seems valid
                return false;
            },
            // Controls promise usage inNode
            poolSize: 40,
        });
    return result;
}

yargs
    .option("owner", {
        required: false,
        alias: 'o',
        description: "GitHub user or organization",
    })
    .option("search", {
            required: false,
            alias: 's',
            description: "Search within repository names"
        }
    )
    .option("query", {
            required: false,
            alias: 'q',
            description: "GitHub query"
        }
    )
    .usage("spider --owner <GitHub user or org> OR --query <GitHub query>");

const commandLineParameters = yargs.argv as any;
const owner = commandLineParameters.owner;
const search = commandLineParameters.search;
const query = commandLineParameters.query;

if (!owner && !query) {
    console.log(`Please specify owner or query`);
    process.exit(1);
}
if (search) {
    console.log(`Limiting to repositories in organization ${owner} with '${search}' in the name`);
}
if (query) {
    console.log(`Running GitHub query '${query}'...`);
} else {
    console.log(`Spidering GitHub organization ${owner}...`);
}

const params = { owner, search, query };

spider(params).then(r => {
    console.log(`Successfully analyzed GitHub ${JSON.stringify(params)}. result is `
        + JSON.stringify(r, null, 2));
}, err => {
    console.log("Oh no! " + err.message);
});
