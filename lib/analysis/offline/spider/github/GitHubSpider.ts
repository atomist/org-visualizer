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
    GitCommandGitProject,
    isLocalProject,
    logger,
    Project,
    RemoteRepoRef,
} from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/lib/operations/common/GitHubRepoRef";
import { isInMemoryProject } from "@atomist/automation-client/lib/project/mem/InMemoryProject";
import {
    Interpretation,
    ProjectAnalysis,
    ProjectAnalyzer,
} from "@atomist/sdm-pack-analysis";
import * as HttpError from "@octokit/request/lib/http-error";
import * as Octokit from "@octokit/rest";
import * as _ from "lodash";
import * as path from "path";
import { SubprojectDescription } from "../../../ProjectAnalysisResult";
import { SubprojectStatus } from "../../../subprojectFinder";
import {
    PersistResult,
    ProjectUrl,
} from "../../persist/ProjectAnalysisResultStore";
import { SpideredRepo } from "../../SpideredRepo";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    PersistenceResult,
    RepoUrl,
    Spider,
    SpiderFailure,
    SpiderOptions,
    SpiderResult,
} from "../Spider";

type CloneFunction = (sourceData: GitHubSearchResult) => Promise<Project>;

/**
 * Spider GitHub. Ensure that GITHUB_TOKEN environment variable is set.
 */
export class GitHubSpider implements Spider {

    constructor(
        private readonly queryFunction: (token: string, criteria: ScmSearchCriteria)
            => AsyncIterable<GitHubSearchResult>
            = queryByCriteria,
        private readonly cloneFunction: CloneFunction = cloneWithCredentialsFromEnv) { }

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: ProjectAnalyzer,
                        opts: SpiderOptions): Promise<SpiderResult> {
        let repoCount = 0;
        const keepExisting: RepoUrl[] = [];
        const errors: SpiderFailure[] = [];
        const analyzeAndPersistResults: AnalyzeAndPersistResult[] = [];
        try {
            const it = this.queryFunction(process.env.GITHUB_TOKEN, criteria);
            let bucket: Array<Promise<AnalyzeAndPersistResult>> = [];
            async function runAllPromisesInBucket(): Promise<void> {
                const results = await Promise.all(bucket);
                results.forEach(r => analyzeAndPersistResults.push(r));
                bucket = [];
            }

            for await (const tooMuchSourceData of it) {
                const sourceData = dropIrrelevantFields(tooMuchSourceData);
                ++repoCount;
                const repo = {
                    owner: sourceData.owner.login,
                    repo: sourceData.name,
                    url: sourceData.url,
                };
                const found = await opts.persister.loadOne(repo);
                if (found && await opts.keepExistingPersisted(found)) {
                    keepExisting.push(repo.url);
                    logger.info("Found valid record for " + JSON.stringify(repo));
                } else {
                    logger.info("Performing fresh analysis of " + JSON.stringify(repo));
                    try {
                        bucket.push(analyzeAndPersist(this.cloneFunction, sourceData, criteria, analyzer, opts));
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
            if (e instanceof HttpError) {
                logger.error("Status %s from %j", e.status, e.request.url);
            }
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

function cloneWithCredentialsFromEnv(sourceData: GitHubSearchResult): Promise<Project> {
    return GitCommandGitProject.cloned(
        process.env.GITHUB_TOKEN ? { token: process.env.GITHUB_TOKEN } : undefined,
        GitHubRepoRef.from({ owner: sourceData.owner.login, repo: sourceData.name }), {
            alwaysDeep: false,
            depth: 1,
        });
}

export interface AnalyzeAndPersistResult {
    failedToCloneOrAnalyze: SpiderFailure[];
    failedToPersist: SpiderFailure[];
    repoCount: number;
    projectCount: number;
    persisted: PersistenceResult[];
}

const emptyAnalyzeAndPersistResult: AnalyzeAndPersistResult = {
    failedToCloneOrAnalyze: [],
    failedToPersist: [],
    repoCount: 0,
    projectCount: 0,
    persisted: [],
};

function combineAnalyzeAndPersistResult(one: AnalyzeAndPersistResult, two: AnalyzeAndPersistResult): AnalyzeAndPersistResult {
    return {
        failedToCloneOrAnalyze: one.failedToCloneOrAnalyze.concat(two.failedToCloneOrAnalyze),
        failedToPersist: one.failedToPersist.concat(two.failedToPersist),
        repoCount: one.repoCount + two.repoCount,
        projectCount: one.projectCount + two.projectCount,
        persisted: one.persisted.concat(two.persisted),
    };
}

/**
 * Future for doing the work
 * @return {Promise<void>}
 */
async function analyzeAndPersist(cloneFunction: CloneFunction,
                                 sourceData: GitHubSearchResult,
                                 criteria: ScmSearchCriteria,
                                 analyzer: ProjectAnalyzer,
                                 opts: SpiderOptions): Promise<AnalyzeAndPersistResult> {
    let project;
    try {
        project = await cloneFunction(sourceData);
    } catch (err) {
        return {
            failedToCloneOrAnalyze: [{ repoUrl: sourceData.url, whileTryingTo: "clone", message: err.message }],
            failedToPersist: [],
            repoCount: 1,
            projectCount: 0,
            persisted: [],
        };
    }
    if (criteria.projectTest && !await criteria.projectTest(project)) {
        logger.info("Skipping analysis of %s as it doesn't pass projectTest", project.id.url);
        return {
            failedToCloneOrAnalyze: [],
            failedToPersist: [],
            repoCount: 1,
            projectCount: 0,
            persisted: [],
        };
    }
    let analyzeResults: AnalyzeResults;
    try {
        analyzeResults = await analyze(project, analyzer, criteria);
    } catch (err) {
        logger.error("Could not clone/analyze " + sourceData.url + ": " + err.message, err);
        return {
            failedToCloneOrAnalyze: [{ repoUrl: sourceData.url, whileTryingTo: "analyze", message: err.message }],
            failedToPersist: [],
            repoCount: 1,
            projectCount: 0,
            persisted: [],
        };
    }
    const persistResults: PersistResult[] = [];
    for (const repoInfo of analyzeResults.repoInfos) {
        if (!criteria.interpretationTest || criteria.interpretationTest(repoInfo.interpretation)) {
            const toPersist: SpideredRepo = {
                analysis: {
                    // Use a spread as url has a getter and otherwise disappears
                    ...repoInfo.analysis,
                    id: {
                        ...repoInfo.analysis.id,
                        url: sourceData.html_url,
                    },
                },
                topics: [], // enriched.interpretation.keywords,
                sourceData,
                timestamp: sourceData.timestamp,
                query: sourceData.query,
                readme: repoInfo.readme,
                subproject: repoInfo.subproject,
            };
            const persistResult = await opts.persister.persist(toPersist);
            if (opts.onPersisted) {
                try {
                    await opts.onPersisted(toPersist);
                } catch (err) {
                    logger.warn("Failed to action after persist repo %j: %s",
                        toPersist.analysis.id, err.message);
                }
            }
            persistResults.push(persistResult);
        }
    }
    return {
        failedToCloneOrAnalyze: [],
        failedToPersist: _.flatMap(persistResults, r => r.failed),
        repoCount: 1,
        projectCount: analyzeResults.projectsDetected,
        persisted: _.flatMap(persistResults, p => p.succeeded),
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

interface RepoInfo {
    readme: string;
    totalFileCount: number;
    interpretation: Interpretation;
    analysis: ProjectAnalysis;
    subproject: SubprojectDescription;
}

interface AnalyzeResults {
    repoInfos: RepoInfo[];
    projectsDetected: number;
}

/**
 * Find project or subprojects
 */
async function analyze(project: Project,
                       analyzer: ProjectAnalyzer,
                       criteria: ScmSearchCriteria): Promise<AnalyzeResults> {

    const subprojectResults = criteria.subprojectFinder ?
        await criteria.subprojectFinder.findSubprojects(project) :
        { status: SubprojectStatus.Unknown };
    if (!!subprojectResults.subprojects && subprojectResults.subprojects.length > 0) {
        const repoInfos = await Promise.all(subprojectResults.subprojects.map(subproject => {
            return projectUnder(project, subproject.path).then(p =>
                analyzeProject(
                    p,
                    analyzer,
                    { ...subproject, parentRepoRef: project.id as RemoteRepoRef }));
        })).then(results => results.filter(x => !!x));
        return {
            projectsDetected: subprojectResults.subprojects.length,
            repoInfos,
        };
    }
    return { projectsDetected: 1, repoInfos: [await analyzeProject(project, analyzer, undefined)] };
}

/**
 * Analyze a project. May be a virtual project, within a bigger project.
 */
async function analyzeProject(project: Project,
                              analyzer: ProjectAnalyzer,
                              subproject?: SubprojectDescription): Promise<RepoInfo> {
    const readmeFile = await project.getFile("README.md");
    const readme = !!readmeFile ? await readmeFile.getContent() : undefined;
    const totalFileCount = await project.totalFileCount();

    const analysis = await analyzer.analyze(project, undefined, { full: true });
    const interpretation = await analyzer.interpret(analysis, undefined);

    return {
        readme,
        totalFileCount,
        interpretation,
        analysis,
        subproject,
    };
}

async function* queryByCriteria(token: string, criteria: ScmSearchCriteria): AsyncIterable<GitHubSearchResult> {
    const octokit = new Octokit();
    if (!!token) {
        octokit.authenticate({
            type: "token",
            token,
        });
    }
    let results: any[] = [];
    let retrieved = 0;
    for (const q of criteria.githubQueries) {
        logger.info("Running query " + q + "...");
        const options = octokit.search.repos.endpoint.merge({ q });
        for await (const response of octokit.paginate.iterator(options)) {
            retrieved += response.data.items.length;
            const newResults = response.data.items
                .filter((r: any) => !results.some(existing => existing.full_name === r.full_name));
            newResults.forEach((r: any) => {
                r.query = q;
                r.timestamp = new Date();
            });
            for (const newResult of newResults) {
                yield newResult;
            }
            logger.info(`Looked at ${retrieved} repos of max ${criteria.maxRetrieved}...`);
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

async function projectUnder(p: Project, pathWithin: string): Promise<Project> {
    if (isInMemoryProject(p)) {
        return p.toSubproject(pathWithin);
    }
    if (!isLocalProject(p)) {
        throw new Error(`Cannot descend into path '${pathWithin}' of non local project`);
    }
    const rid = p.id as RemoteRepoRef;
    const newId: RemoteRepoRef = {
        ...rid,
        path: pathWithin,
    };
    return GitCommandGitProject.fromBaseDir(
        newId,
        path.join(p.baseDir, pathWithin),
        (p as any).credentials,
        p.release,
    );
}
