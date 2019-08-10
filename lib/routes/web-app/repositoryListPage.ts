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
    Express,
    RequestHandler,
} from "express";
import {
    RepoForDisplay,
    RepoList,
} from "../../../views/repoList";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import { ProjectAnalysisResultStore } from "../../analysis/offline/persist/ProjectAnalysisResultStore";
import { AspectRegistry } from "../../aspect/AspectRegistry";
import { scoreRepos } from "../../scorer/scoring";
import { tagRepos } from "../support/tagUtils";

export type SortOrder = "name" | "score";

/**
 * Takes sortOrder optional parameter to dictate sorting
 */
export function exposeRepositoryListPage(express: Express,
                                         handlers: RequestHandler[],
                                         aspectRegistry: AspectRegistry,
                                         store: ProjectAnalysisResultStore): void {
    express.get("/repositories", ...handlers, async (req, res) => {
        const workspaceId = req.query.workspace || req.params.workspace_id || "*";
        const sortOrder: SortOrder = req.query.sortOrder || "score";

        const allAnalysisResults = await store.loadInWorkspace(workspaceId, true);

        // optional query parameter: owner
        const relevantAnalysisResults = allAnalysisResults.filter(ar => req.query.owner ? ar.analysis.id.owner === req.query.owner : true);
        if (relevantAnalysisResults.length === 0) {
            return res.send(`No matching repos for organization ${req.query.owner}`);
        }

        const relevantRepos = await scoreRepos(
            aspectRegistry,
            tagRepos(aspectRegistry, {
                // TODO fix this
                averageFingerprintCount: -1,
                repoCount: relevantAnalysisResults.length,
            }, relevantAnalysisResults));

        const reposForDisplay: RepoForDisplay[] = relevantRepos.map(ar => ({
            url: ar.repoRef.url,
            repo: ar.repoRef.repo,
            owner: ar.repoRef.owner,
            id: ar.id,
            score: ar.weightedScore.weightedScore,
        }));
        const virtualProjectCount = await store.virtualProjectCount(workspaceId);
        return res.send(renderStaticReactNode(
            RepoList({
                repos: reposForDisplay,
                virtualProjectCount,
                sortOrder,
            }),
            "Repository list"));
    });
}
