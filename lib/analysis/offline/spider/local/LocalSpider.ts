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

import { ProjectAnalyzer } from "@atomist/sdm-pack-analysis";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    Spider,
    SpiderOptions,
    SpiderResult,
} from "../Spider";

import {
    GitCommandGitProject,
    NodeFsLocalProject,
    RepoId,
    RepoRef,
} from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import * as fs from "fs-extra";
import * as path from "path";
import {
    combinePersistResults,
    emptyPersistResult,
    PersistResult,
} from "../../persist/ProjectAnalysisResultStore";
import {
    analyze,
    AnalyzeResults,
    keepExistingPersisted,
    persistRepoInfo,
} from "../common";

export class LocalSpider implements Spider {
    constructor(public readonly localDirectory: string) { }

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: ProjectAnalyzer,
                        opts: SpiderOptions): Promise<SpiderResult> {

        const repoIterator = findRepositoriesUnder(this.localDirectory);

        const results: SpiderResult[] = [];

        for await (const repoDir of repoIterator) {
            console.log(repoDir);
            results.push(await spiderOneLocalRepo(opts, criteria, analyzer, repoDir));
        }

        return results.reduce(combineSpiderResults, emptySpiderResult);
    }
}

function combineSpiderResults(r1: SpiderResult, r2: SpiderResult): SpiderResult {
    return {
        repositoriesDetected: r1.repositoriesDetected + r2.repositoriesDetected,
        projectsDetected: r1.projectsDetected + r2.projectsDetected,
        failed:
            [...r1.failed, ...r2.failed],
        keptExisting: [...r1.keptExisting, ...r2.keptExisting],
        persistedAnalyses: [...r1.persistedAnalyses, ...r2.persistedAnalyses],
    };
}

const emptySpiderResult = {
    repositoriesDetected: 0,
    projectsDetected: 0,
    failed:
        [],
    keptExisting: [],
    persistedAnalyses: [],
};

const oneSpiderResult = {
    ...emptySpiderResult,
    repositoriesDetected: 1,
    projectsDetected: 1,
};

async function spiderOneLocalRepo(opts: SpiderOptions,
                                  criteria: ScmSearchCriteria,
                                  analyzer: ProjectAnalyzer,
                                  repoDir: string): Promise<SpiderResult> {
    const localRepoRef = await repoRefFromLocalRepo(repoDir);

    if (await keepExistingPersisted(opts, localRepoRef)) {
        return {
            ...oneSpiderResult,
            keptExisting: [localRepoRef.url],
        };
    }

    const project = await GitCommandGitProject.fromExistingDirectory(localRepoRef, repoDir);

    if (criteria.projectTest && !await criteria.projectTest(project)) {
        return {
            ...oneSpiderResult,
            projectsDetected: 0,        // does not count as a project
        };
    }

    let analyzeResults: AnalyzeResults;
    try {
        analyzeResults = await analyze(project, analyzer, criteria);
    } catch (err) {
        return {
            ...oneSpiderResult,
            failed: [{
                repoUrl: localRepoRef.url,
                whileTryingTo: "analyze",
                message: err.message,
            }],
        };
    }

    const persistResults: PersistResult[] = [];
    for (const repoInfo of analyzeResults.repoInfos) {
        if (!criteria.interpretationTest || criteria.interpretationTest(repoInfo.interpretation)) {
            const persistResult = await persistRepoInfo(opts, repoInfo, {
                sourceData: { localDirectory: repoDir },
                url: localRepoRef.url,
                timestamp: new Date(),
            });
            persistResults.push(persistResult);
        }
    }
    const combinedPersistResult = persistResults.reduce(combinePersistResults, emptyPersistResult);

    return {
        repositoriesDetected: 1,
        projectsDetected: analyzeResults.projectsDetected,
        failed: combinedPersistResult.failed,
        persistedAnalyses: combinedPersistResult.succeeded,
        keptExisting: [],
    };
}

async function* findRepositoriesUnder(dir: string): AsyncIterable<string> {
    try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) {
            // nothing interesting
            return;
        }
    } catch (err) {
        throw new Error("Error opening " + dir + ": " + err.message);
    }

    const dirContents = await fs.readdir(dir);
    if (dirContents.includes(".git")) {
        // this is the repository you are looking for
        yield dir;
        return;
    }

    // recurse over everything inside
    for (const d of dirContents) {
        for await (const dd of findRepositoriesUnder(path.join(dir, d))) {
            yield dd;
        }
    }
}

/**
 * @param repoDir full path to repository
 */
async function repoRefFromLocalRepo(repoDir: string): Promise<RepoRef> {
    const repoId: RepoId = await execPromise("git", ["remote", "get-url", "origin"], { cwd: repoDir })
        .then(execHappened => repoIdFromOriginUrl(execHappened.stdout))
        .catch(oops => inventRepoId(repoDir));

    const sha = await execPromise("git", ["rev-parse", "HEAD", "origin"], { cwd: repoDir })
        .then(execHappened => execHappened.stdout)
        .catch(oops => "unknown");

    return {
        ...repoId,
        sha,
    };
}

function repoIdFromOriginUrl(originUrl: string): RepoId {
    const parse = /\/(?<owner>.+)\/(?<repo>.+)(.git)?$/.exec(originUrl);

    if (!parse) {
        throw new Error("Can't identify owner and repo in url: " + originUrl);
    }

    return {
        repo: parse.groups.repo,
        owner: parse.groups.owner,
        url: originUrl,
    };
}

function inventRepoId(repoDir: string): RepoId {
    const { base, dir } = path.parse(repoDir);
    const repo = base;
    const owner = path.parse(dir).base || "pretendOwner";

    return {
        repo,
        owner,
        url: "file://" + repoDir,
    };
}
