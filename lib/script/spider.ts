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

import {
    configureLogging,
    logger,
    MinimalLogging,
    PlainLogging,
} from "@atomist/automation-client";
import { loadUserConfiguration } from "@atomist/automation-client/lib/configuration";
import * as path from "path";
import * as yargs from "yargs";
import { fileNamesSubprojectFinder } from "../analysis/fileNamesSubprojectFinder";
import { PostgresProjectAnalysisResultStore } from "../analysis/offline/persist/PostgresProjectAnalysisResultStore";
import { GitHubSpider } from "../analysis/offline/spider/github/GitHubSpider";
import { LocalSpider } from "../analysis/offline/spider/local/LocalSpider";
import { Spider } from "../analysis/offline/spider/Spider";
import { firstSubprojectFinderOf } from "../analysis/subprojectFinder";
import {
    createAnalyzer,
    sdmConfigClientFactory,
} from "../machine/machine";
import { ScmSearchCriteria } from "../analysis/offline/spider/ScmSearchCriteria";

import * as _ from "lodash";

// Ensure we see console logging, and send info to the console
configureLogging(PlainLogging);

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

    /**
     * Update existing analyses for the same sha?
     * Take care to set this to false if the spider code has been updated
     */
    update?: boolean;
}

/**
 * Spider a GitHub.com org
 */
async function spider(params: SpiderAppOptions) {
    const analyzer = createAnalyzer(undefined);
    const org = params.owner;
    const searchInRepoName = search ? ` ${search} in:name` : "";

    const spider: Spider = params.source === "GitHub" ? new GitHubSpider() : new LocalSpider(params.localDirectory);
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
            return !!params.update;
        },
        subprojectFinder: firstSubprojectFinderOf(
            fileNamesSubprojectFinder(
                "pom.xml",
                "build.gradle",
                "package.json",
                "requirements.txt"),
        ),
    };

    const arr = new Array<string>(JSON.stringify(criteria).length + 20);
    _.fill(arr, "-");
    const sep = arr.join("");
    logger.info("%s\nOptions: %j\nSpider criteria: %j\n%s\n\n", sep, params, criteria, sep);
    return spider.spider(criteria,
        analyzer,
        {
            persister,
            keepExistingPersisted: async existing => {
                // Perform a computation here to return true if an existing analysis seems valid
                const keep = !params.update;
                logger.info(keep ?
                    `Retaining existing analysis for ${existing.analysis.id.url}:${existing.analysis.id.sha}` :
                    `Recomputing analysis for ${existing.analysis.id.url}:${existing.analysis.id.sha}`);
                return keep;
            },
            // Controls promise usage inNode
            poolSize: 40,
            workspaceId,
        });
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
    .option("update", {
        type: "boolean",
        required: false,
        default: false,
        alias: "u",
        description: "always update existing analyses for same commit sha",
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

const params: SpiderAppOptions = {
    owner, search, query, workspaceId, source,
    localDirectory, update: commandLineParameters.update
};

spider(params).then(r => {
    console.log(`Successfully analyzed ${JSON.stringify(params)}. result is `
        + JSON.stringify(r, null, 2));
}, err => {
    console.log("Failure: " + err.message);
});
