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
    Project,
    RepoRef,
} from "@atomist/automation-client";
import { FP } from "@atomist/clj-editors";
import { SdmContext } from "@atomist/sdm";
import {
    Interpretation,
    ProjectAnalysis,
    ProjectAnalyzer,
} from "@atomist/sdm-pack-analysis";
import { ProjectAnalysisOptions } from "@atomist/sdm-pack-analysis/lib/analysis/ProjectAnalysis";
import * as assert from "assert";
import {
    FingerprintKind,
    PersistResult,
    ProjectAnalysisResultStore,
} from "../../../lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { ScmSearchCriteria } from "../../../lib/analysis/offline/spider/ScmSearchCriteria";
import {
    EmptySpiderResult,
    SpiderOptions,
    SpiderResult,
} from "../../../lib/analysis/offline/spider/Spider";
import {
    isProjectAnalysisResult,
    ProjectAnalysisResult,
} from "../../../lib/analysis/ProjectAnalysisResult";
import { SubprojectStatus } from "../../../lib/analysis/subprojectFinder";
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

const oneResult: ProjectAnalysisResult = {

} as ProjectAnalysisResult;

const criteria: ScmSearchCriteria = {
    githubQueries: [],
    maxRetrieved: 10,
    maxReturned: 10,
};
const oneProjectAnalysis: ProjectAnalysis = {
    jessitronSays: "I am this project analysis object",
} as any;
// tslint:disable-next-line:no-object-literal-type-assertion
const analyzer: ProjectAnalyzer = {
    async analyze(p: Project,
                  sdmContext: SdmContext,
                  options?: ProjectAnalysisOptions): Promise<ProjectAnalysis> {
        return oneProjectAnalysis;
    },
    async interpret(p: Project | ProjectAnalysis,
                    sdmContext: SdmContext,
                    options?: ProjectAnalysisOptions): Promise<Interpretation> {
        // tslint:disable-next-line:no-object-literal-type-assertion
        return { jessitronSays: "Fake interpretation object" } as any as Interpretation;
    },

} as ProjectAnalyzer;
const hardCodedPlace = "place.json";

class FakeProjectAnalysisResultStore implements ProjectAnalysisResultStore {

    public persisted: ProjectAnalysisResult[] = [];
    public count(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    public loadWhere(): Promise<ProjectAnalysisResult[]> {
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

    public computeAnalyticsForFingerprintKind(workspaceId: string, type: string, name: string): Promise<void> {
        return undefined;
    }

    public distinctFingerprintKinds(workspaceId: string): Promise<FingerprintKind[]> {
        return undefined;
    }

    public fingerprintsInWorkspace(workspaceId: string, type?: string, name?: string): Promise<FP[]> {
        return undefined;
    }

    public async computeAnalytics(workspaceId: string): Promise<void> {
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
        const subject = new GitHubSpider(async function*(t, q) { },
        );

        const result = await subject.spider(undefined, undefined,
            { persister: new FakeProjectAnalysisResultStore()} as any);

        assert.deepStrictEqual(result, EmptySpiderResult);
    });

    it("reveals failure when one fails to clone", async () => {
        // this function is pretty darn elaborate

        const subject = new GitHubSpider(async function*(t, q) { yield oneSearchResult; },
            async sd => { throw new Error("cannot clone"); });

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

    it("can make and persist an analysis", async () => {
        // this function is pretty darn elaborate

        const subject = new GitHubSpider(async function*(t, q) { yield oneSearchResult; },
            async sd => InMemoryProject.of({ path: "README.md", content: "hi there" }));

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

    it.skip("persists multiple analyses with subprojects", async () => {
        // this function is pretty darn elaborate

        const subject = new GitHubSpider(async function*(t, q) { yield oneSearchResult; },
            async sd => InMemoryProject.of({ path: "README.md", content: "hi there" }));

        const myOpts = opts();
        const myCriteria: ScmSearchCriteria = {
            ...criteria,
            subprojectFinder: {
                name: "Here and There subproject finder",
                findSubprojects: async p => {
                    return {
                        status: SubprojectStatus.IdentifiedPaths,
                        subprojects: [{
                            path: "here", reason: "hard coded",
                        }, { path: "there", reason: "hard coded" }],
                    };
                },
            },
        };
        const result = await subject.spider(myCriteria, analyzer, myOpts);

        const expected: SpiderResult = {
            repositoriesDetected: 1,
            projectsDetected: 2,
            failed: [],
            persistedAnalyses: [hardCodedPlace, hardCodedPlace],
            keptExisting: [],
        };

        assert.deepStrictEqual(result, expected);

        const persisted = (myOpts.persister as FakeProjectAnalysisResultStore).persisted;

        persisted.forEach(pa => {
            assert(!!pa.subproject, "should have a subproject");
            assert.strictEqual(pa.subproject.reason, "hard coded");
        });

        assert.strictEqual(persisted.length, 2);
    });
});
