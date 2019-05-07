#!/usr/bin/env node

// tslint:disable

import { FileSystemProjectAnalysisResultStore } from "../analysis/offline/persist/FileSystemProjectAnalysisResultStore";
import { GitHubSpider } from "../analysis/offline/spider/github/GitHubSpider";
import { Spider } from "../analysis/offline/spider/Spider";
import { createAnalyzer } from "../machine/machine";
import { configureLogging, MinimalLogging } from "@atomist/automation-client";

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
