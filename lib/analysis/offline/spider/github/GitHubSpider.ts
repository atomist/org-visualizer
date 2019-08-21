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

import {
    LocalProject,
    logger,
    Project,
} from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import * as Octokit from "@octokit/rest";
import * as _ from "lodash";
import { PersistResult } from "../../persist/ProjectAnalysisResultStore";
import { computeAnalytics } from "../analytics";
import {
    analyze,
    AnalyzeResults,
    existingRecordShouldBeKept,
    persistRepoInfo,
} from "../common";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    Analyzer,
    logTimings,
    PersistenceResult,
    RepoUrl,
    Spider,
    SpiderFailure,
    SpiderOptions,
    SpiderResult,
} from "../Spider";

/**
 * Implementating this allows control over cloning
 */
export interface Cloner {

    clone(sourceData: GitHubSearchResult): Promise<Project>;
}

/**
 * Spider GitHub. Ensure that GITHUB_TOKEN environment variable is set.
 */
export class GitHubSpider implements Spider {

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: Analyzer,
                        opts: SpiderOptions): Promise<SpiderResult> {
        let repoCount = 0;
        const keepExisting: RepoUrl[] = [];
        const errors: SpiderFailure[] = [];
        const analyzeAndPersistResults: AnalyzeAndPersistResult[] = [];

        try {
            const it = this.queryFunction(process.env.GITHUB_TOKEN, criteria);
            let bucket: Array<Promise<AnalyzeResult & { analyzeResults?: AnalyzeResults, sourceData: GitHubSearchResult }>> = [];

            async function runAllPromisesInBucket(): Promise<void> {
                const aResults = await Promise.all(bucket);
                for (const ar of aResults) {
                    // Avoid hitting the database in parallel to avoid locking
                    analyzeAndPersistResults.push(await runPersist(criteria, opts, ar));
                }

                logger.debug("Computing analytics over fingerprints...");
                await computeAnalytics(opts.persister, opts.workspaceId);

                logTimings(analyzer.timings);

                bucket = [];
            }

            for await (const sourceData of it) {
                ++repoCount;
                const repo = {
                    owner: sourceData.owner.login,
                    repo: sourceData.name,
                    url: sourceData.url,
                };
                if (await existingRecordShouldBeKept(opts, repo)) {
                    keepExisting.push(repo.url);
                    logger.debug("Found valid record for " + JSON.stringify(repo));
                } else {
                    logger.debug("Performing fresh analysis of " + JSON.stringify(repo));
                    try {
                        bucket.push(
                            runAnalysis(this.cloner,
                                dropIrrelevantFields(sourceData),
                                criteria,
                                analyzer));
                        if (bucket.length >= opts.poolSize) {
                            // Run all promises together. Effectively promise pooling
                            await runAllPromisesInBucket();
                        }
                    } catch (err) {
                        errors.push({
                            repoUrl: sourceData.url,
                            whileTryingTo: "clone, analyze, and persist", message: err.message,
                        });
                        logger.error("Failure analyzing repo at %s: %s", sourceData.url, err.message);
                    }
                }
            }
            await runAllPromisesInBucket();
        } catch (e) {
            logger.error("Error spidering: %s", e.message);
            throw e;
        }

        const analyzeResults = _.reduce(analyzeAndPersistResults,
            combineAnalyzeAndPersistResult,
            emptyAnalyzeAndPersistResult);
        return {
            repositoriesDetected: repoCount,
            projectsDetected: analyzeResults.projectCount,
            failed:
                [...errors,
                    ...analyzeResults.failedToPersist,
                    ...analyzeResults.failedToCloneOrAnalyze],
            keptExisting: keepExisting,
            persistedAnalyses: analyzeResults.persisted,
        };
    }

    public constructor(
        private readonly cloner: Cloner,
        private readonly queryFunction: (token: string, criteria: ScmSearchCriteria)
            => AsyncIterable<GitHubSearchResult>
            = queryByCriteria) {
    }

}

function dropIrrelevantFields(sourceData: GitHubSearchResult): GitHubSearchResult {
    return {
        owner: { login: sourceData.owner.login },
        name: sourceData.name,
        url: sourceData.url,
        html_url: sourceData.html_url,
        timestamp: sourceData.timestamp,
        query: sourceData.query,
    };
}

export interface AnalyzeResult {
    failedToCloneOrAnalyze: SpiderFailure[];
    repoCount: number;
    projectCount: number;
    millisTaken: number;
}

export interface AnalyzeAndPersistResult extends AnalyzeResult {
    failedToPersist: SpiderFailure[];
    persisted: PersistenceResult[];
}

const emptyAnalyzeAndPersistResult: AnalyzeAndPersistResult = {
    failedToCloneOrAnalyze: [],
    failedToPersist: [],
    repoCount: 0,
    projectCount: 0,
    persisted: [],
    millisTaken: 0,
};

function combineAnalyzeAndPersistResult(one: AnalyzeAndPersistResult, two: AnalyzeAndPersistResult): AnalyzeAndPersistResult {
    return {
        failedToCloneOrAnalyze: one.failedToCloneOrAnalyze.concat(two.failedToCloneOrAnalyze),
        failedToPersist: one.failedToPersist.concat(two.failedToPersist),
        repoCount: one.repoCount + two.repoCount,
        projectCount: one.projectCount + two.projectCount,
        persisted: one.persisted.concat(two.persisted),
        millisTaken: one.millisTaken + two.millisTaken,
    };
}

/**
 * Future for doing the work
 * @return {Promise<void>}
 */
async function runAnalysis(cloner: Cloner,
                           sourceData: GitHubSearchResult,
                           criteria: ScmSearchCriteria,
                           analyzer: Analyzer): Promise<AnalyzeResult & { analyzeResults?: AnalyzeResults, sourceData: GitHubSearchResult }> {
    const startTime = new Date().getTime();
    let project;
    let clonedIn: number;
    try {
        project = await cloner.clone(sourceData);
        clonedIn = new Date().getTime() - startTime;
        logger.debug("Successfully cloned %s in %d milliseconds", sourceData.url, clonedIn);
        if (!project.id.sha) {
            const sha = await execPromise("git", ["rev-parse", "HEAD"], {
                cwd: (project as LocalProject).baseDir,
            });
            project.id.sha = sha.stdout.trim();
            logger.debug(`Set sha to ${project.id.sha}`);
        }
    } catch (err) {
        return {
            failedToCloneOrAnalyze: [{ repoUrl: sourceData.url, whileTryingTo: "clone", message: err.message }],
            repoCount: 1,
            projectCount: 0,
            millisTaken: new Date().getTime() - startTime,
            sourceData,
        };
    }
    if (criteria.projectTest && !await criteria.projectTest(project)) {
        logger.debug("Skipping analysis of %s as it doesn't pass projectTest", project.id.url);
        return {
            failedToCloneOrAnalyze: [],
            repoCount: 1,
            projectCount: 0,
            millisTaken: new Date().getTime() - startTime,
            sourceData,
        };
    }
    let analyzeResults: AnalyzeResults;
    try {
        analyzeResults = await analyze(project, analyzer, criteria);
        const millisTaken = new Date().getTime() - startTime;
        logger.debug("Successfully analyzed %s in %d milliseconds including clone time of %d",
            sourceData.url, millisTaken, clonedIn);
        return {
            failedToCloneOrAnalyze: [],
            repoCount: 1,
            projectCount: 0,
            millisTaken,
            analyzeResults,
            sourceData,

        };
    } catch (err) {
        logger.error("Could not analyze " + sourceData.url + ": " + err.message, err);
        return {
            failedToCloneOrAnalyze: [{ repoUrl: sourceData.url, whileTryingTo: "analyze", message: err.message }],
            repoCount: 1,
            projectCount: 0,
            millisTaken: new Date().getTime() - startTime,
            sourceData,
        };
    }
}

async function runPersist(criteria: ScmSearchCriteria,
                          opts: SpiderOptions,
                          ar: AnalyzeResult & { analyzeResults?: AnalyzeResults, sourceData: GitHubSearchResult }): Promise<AnalyzeAndPersistResult> {
    const persistResults: PersistResult[] = [];

    logger.debug("Persisting...");
    if (!ar.analyzeResults) {
        return {
            failedToCloneOrAnalyze: ar.failedToCloneOrAnalyze,
            repoCount: ar.repoCount,
            projectCount: ar.projectCount,
            failedToPersist: [],
            persisted: [],
            millisTaken: ar.millisTaken,
        };
    }

    for (const repoInfo of ar.analyzeResults.repoInfos) {
        const persistResult = await persistRepoInfo(opts, repoInfo, {
            sourceData: ar.sourceData,
            url: ar.sourceData.html_url,
            timestamp: ar.sourceData.timestamp,
            query: ar.sourceData.query,
        });
        persistResults.push(persistResult);
    }
    return {
        failedToCloneOrAnalyze: ar.failedToCloneOrAnalyze,
        repoCount: 1,
        projectCount: 1,
        failedToPersist: _.flatMap(persistResults, r => r.failed),
        persisted: _.flatMap(persistResults, p => p.succeeded),
        millisTaken: ar.millisTaken,
    };
}

/**
 * Result row in a GitHub search
 */
export interface GitHubSearchResult {
    owner: { login: string };
    name: string;
    url: string;
    html_url: string;
    timestamp: Date;
    query: string;
}

async function* queryByCriteria(token: string, criteria: ScmSearchCriteria): AsyncIterable<GitHubSearchResult> {
    const octokit = new Octokit({
        auth: token ? "token " + token : undefined,
        baseUrl: "https://api.github.com",
    });
    let results: any[] = [];
    let retrieved = 0;
    for (const q of criteria.githubQueries) {
        logger.debug("Running query " + q + "...");
        const options = octokit.search.repos.endpoint.merge({ q });
        for await (const response of octokit.paginate.iterator(options)) {
            retrieved += response.data.length;
            const newResults = response.data
                .filter((r: any) => !results.some(existing => existing.full_name === r.full_name));
            newResults.forEach((r: any) => {
                r.query = q;
                r.timestamp = new Date();
            });
            for (const newResult of newResults) {
                yield newResult;
            }
            logger.debug(`Looked at ${retrieved} repos of max ${criteria.maxRetrieved}...`);
            if (retrieved > criteria.maxRetrieved) {
                break;
            }
            if (results.length > criteria.maxReturned) {
                results = results.slice(0, criteria.maxReturned);
                break;
            }
        }
    }
}
