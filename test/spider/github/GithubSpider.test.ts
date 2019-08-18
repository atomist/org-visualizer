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
    InMemoryProject,
    RepoRef,
} from "@atomist/automation-client";
import { TmpDirectoryManager } from "@atomist/automation-client/lib/spi/clone/tmpDirectoryManager";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { FP } from "@atomist/sdm-pack-fingerprints";
import * as assert from "assert";
import {
    FingerprintKind,
    FingerprintUsage,
    PersistResult,
    ProjectAnalysisResultStore,
} from "../../../lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { GitCommandGitProjectCloner } from "../../../lib/analysis/offline/spider/github/GitCommandGitProjectCloner";
import { ScmSearchCriteria } from "../../../lib/analysis/offline/spider/ScmSearchCriteria";
import {
    Analyzer,
    EmptySpiderResult,
    SpiderOptions,
    SpiderResult,
} from "../../../lib/analysis/offline/spider/Spider";
import {
    isProjectAnalysisResult,
    ProjectAnalysisResult,
} from "../../../lib/analysis/ProjectAnalysisResult";
import { PlantedTree } from "../../../lib/tree/sunburst";
import {
    GitHubSearchResult,
    GitHubSpider,
} from "./../../../lib/analysis/offline/spider/github/GitHubSpider";

// tslint:disable
const oneSearchResult: GitHubSearchResult = {
    owner: { login: "owner" },
    name: "reponame",
    url: "https://home",
} as GitHubSearchResult;

const oneResult: ProjectAnalysisResult = {} as ProjectAnalysisResult;

const criteria: ScmSearchCriteria = {
    githubQueries: [],
    maxRetrieved: 10,
    maxReturned: 10,
};
const oneProjectAnalysis: ProjectAnalysis = {
    jessitronSays: "I am this project analysis object",
} as any;
// tslint:disable-next-line:no-object-literal-type-assertion
const analyzer: Analyzer = {
    analyze: async p => oneProjectAnalysis,
    timings: {},
};

const hardCodedPlace = "place.json";

class FakeProjectAnalysisResultStore implements ProjectAnalysisResultStore {

    public persisted: ProjectAnalysisResult[] = [];

    public fingerprintsToReposTree(): Promise<PlantedTree> {
        throw new Error("Method not implemented");
    }

    public aspectDriftTree(workspaceId: string, threshold: number, type?: string): Promise<PlantedTree> {
        throw new Error("Method not implemented");
    }

    public distinctRepoCount(): Promise<number> {
        throw new Error("Method not implemented.");
    }

    public latestTimestamp(workspaceId: string): Promise<Date> {
        throw new Error("Method not implemented.");
    }

    public virtualProjectCount(workspaceId: string): Promise<number> {
        throw new Error("Method not implemented.");
    }

    public loadInWorkspace(): Promise<ProjectAnalysisResult[]> {
        throw new Error("Method not implemented.");
    }

    public async loadByRepoRef(repo: RepoRef): Promise<ProjectAnalysisResult> {
        return oneResult;
    }

    public loadById(id: string): Promise<ProjectAnalysisResult | undefined> {
        throw new Error("Method not implemented.");
    }

    public async persist(repoOrRepos: ProjectAnalysisResult
        | ProjectAnalysisResult[] | AsyncIterable<ProjectAnalysisResult>): Promise<PersistResult> {
        const repos = isProjectAnalysisResult(repoOrRepos) ? [repoOrRepos] : repoOrRepos;
        let persisted = 0;
        const where = [];
        for await (const repo of repos) {
            persisted++;
            this.persisted.push(repo);
            where.push(hardCodedPlace);
        }
        return { attemptedCount: persisted, failed: [], succeeded: where };
    }

    public async fingerprintUsageForType(workspaceId: string, type?: string): Promise<FingerprintUsage[]> {
        return [];
    }

    public fingerprintsForProject(snapshotId: string): Promise<[]> {
        return undefined;
    }

    public computeAnalyticsForFingerprintKind(): Promise<void> {
        return undefined;
    }

    public async distinctFingerprintKinds(): Promise<FingerprintKind[]> {
        return [];
    }

    public fingerprintsInWorkspace(workspaceId: string, type?: string, name?: string): Promise<any> {
        return undefined;
    }

    public async persistAnalytics(): Promise<boolean> {
        return true;
    }

    public fingerprintsInWorkspaceRecord(workspaceId: string, type?: string, name?: string): Promise<Record<string, FP & { id: string }>> {
        throw new Error("Method not implemented.");
    }

    public async averageFingerprintCount(workspaceId?: string): Promise<number> {
        return -1;
    }

}

function opts(): SpiderOptions {
    return {
        // tslint:disable-next-line:no-object-literal-type-assertion
        persister: new FakeProjectAnalysisResultStore(),
        keepExistingPersisted: async r => false,
        poolSize: 3,
        workspaceId: "local",
    };
}

describe("GithubSpider", () => {

    it("gives empty results when query returns empty", async () => {
        const subject = new GitHubSpider(new GitCommandGitProjectCloner(TmpDirectoryManager),
            async function* (t, q) {
            },
        );

        const result = await subject.spider(undefined, analyzer,
            { persister: new FakeProjectAnalysisResultStore() } as any);

        assert.deepStrictEqual(result, EmptySpiderResult);
    });

    it("reveals failure when one fails to clone", async () => {
        const subject = new GitHubSpider(
            {
                clone: async () => {
                    throw new Error("cannot clone");
                }
            },
            async function* (t, q) {
                yield oneSearchResult;
            });

        const result = await subject.spider(criteria, analyzer, opts());
        const expected: SpiderResult = {
            repositoriesDetected: 1,
            projectsDetected: 0,
            failed: [{ repoUrl: "https://home", whileTryingTo: "clone", message: "cannot clone" }],
            persistedAnalyses: [],
            keptExisting: [],
        };
        assert.deepStrictEqual(result, expected);
    });

    // TODO this is currently hanging, possible because monorepo support doesn't like in memory project
    it.skip("can make and persist an analysis", async () => {
        const subject = new GitHubSpider(
            { clone: async () => InMemoryProject.of({ path: "README.md", content: "hi there" }) },
            async function* (t, q) {
                yield oneSearchResult;
            },
        );

        const myOpts = opts();
        const result = await subject.spider(criteria, analyzer, myOpts);

        const expected: SpiderResult = {
            repositoriesDetected: 1,
            projectsDetected: 1,
            failed: [],
            persistedAnalyses: [hardCodedPlace],
            keptExisting: [],
        };

        assert.deepStrictEqual(result, expected);
        const persisted = (myOpts.persister as FakeProjectAnalysisResultStore).persisted;
        assert.strictEqual(persisted.length, 1);
    });

});
