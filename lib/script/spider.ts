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

import { FileSystemProjectAnalysisResultStore } from "../analysis/offline/persist/FileSystemProjectAnalysisResultStore";
import { GitHubSpider } from "../analysis/offline/spider/github/GitHubSpider";
import { Spider } from "../analysis/offline/spider/Spider";
import { createAnalyzer } from "../machine/machine";
import {
    configureLogging,
    MinimalLogging,
} from "@atomist/automation-client";

// Ensure we see console logging, and send info to the console
configureLogging(MinimalLogging);

/**
 * Spider a GitHub.com org
 */
async function spider(org: string) {
    const analyzer = createAnalyzer(undefined);

    const spider: Spider = new GitHubSpider();
    const persister = new FileSystemProjectAnalysisResultStore();

    await spider.spider({
        githubQueries: [`org:${org}`],
        maxRetrieved: 1500,
        maxReturned: 1500,
        // projectTest: async p => await p.hasFile(".travis.yml") && p.hasFile("package.json"),
    }, analyzer, {
        persister,
        keepExistingPersisted: async existing => {
            console.log(`\tAnalyzing ${existing.analysis.id.url}`);
            return false; // !!existing.analysis.elements.scripts
        },
        poolSize: 40,
    });
}

if (process.argv.length < 3) {
    console.log("Usage: spider <git hub organization>");
    process.exit(1);
}

const org = process.argv[2];
console.log(`Will spider GitHub organization ${org}...`);
spider(org).then(r => {
    console.log(`Succesfully spidered GitHub organization ${org}`);
});
