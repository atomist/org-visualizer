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
import * as path from "path";
import { Client } from "pg";
import { LocalSpider } from "../analysis/offline/spider/local/LocalSpider";

// Ensure we see console logging, and send info to the console
configureLogging(MinimalLogging);

process.on('uncaughtException', function (err) {
    console.log(err);
    console.log(err.stack);
    process.exit(1);
});

interface SpiderAppOptions {

    source: "GitHub" | "local"

    localDirectory?: string;

    owner?: string;

    /**
     * Refine name in GitHub search if searching for repos
     */
    search?: string;

    /**
     * If this is supplied, run a custom GitHub query
     */
    query?: string;

    workspaceId: string;
}

/**
 * Spider a GitHub.com org
 */
async function spider(params: SpiderAppOptions) {
    const analyzer = createAnalyzer(undefined);
    const org = params.owner;
    const searchInRepoName = search ? ` ${search} in:name` : "";

    const spider: Spider = params.source === "GitHub" ? new GitHubSpider() : new LocalSpider(params.localDirectory);
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
            workspaceId,
        });
    return result;
}

yargs
    .option("owner", {
        required: false,
        alias: 'o',
        requiresArg: true,
        description: "GitHub user or organization",
    })
    .option("search", {
        required: false,
        alias: 's',
        requiresArg: true,
        description: "Search within repository names"
    }
    )
    .option("query", {
        required: false,
        alias: 'q',
        requiresArg: true,
        description: "GitHub query"
    }
    )
    .option("workspace", {
        required: false,
        requiresArg: true,
        alias: 'w',
        description: "Name of Atomist workspace to store results under"
    }
    )
    .option("localDirectory", {
        required: false,
        alias: "l",
        requiresArg: true,
        description: "local directory to search for repositories (instead of GitHub)",
    })
    .strict()
    .usage("spider <GitHub criteria: supply owner or query>\nspider --localDirectory <directory containing repositories>");

const commandLineParameters = yargs.argv as any;
const owner = commandLineParameters.owner;
const search = commandLineParameters.search;
const query = commandLineParameters.query;
const workspaceId = commandLineParameters.workspace || commandLineParameters.owner || "local";
const source: "local" | "GitHub" = commandLineParameters.localDirectory ? "local" : "GitHub";
const localDirectory = commandLineParameters.localDirectory ? path.resolve(commandLineParameters.localDirectory) : "";


if (!owner && !query && !localDirectory) {
    console.log(`Please specify owner, query, or local directory`);
    process.exit(1);
}
if (localDirectory) {
    console.log(`Spidering repositories under ${localDirectory}...`)
} else {
    if (search) {
        console.log(`Spidering GitHub repositories in organization ${owner} with '${search}' in the name...`);
    }
    if (query) {
        console.log(`Running GitHub query '${query}' for workspace '${workspaceId}'...`);
    } else {
        console.log(`Spidering GitHub organization ${owner} for workspace '${workspaceId}'...`);
    }
}

const params: SpiderAppOptions = { owner, search, query, workspaceId, source, localDirectory };

spider(params).then(r => {
    console.log(`Successfully analyzed ${JSON.stringify(params)}. result is `
        + JSON.stringify(r, null, 2));
}, err => {
    console.log("Failure: " + err.message);
});
