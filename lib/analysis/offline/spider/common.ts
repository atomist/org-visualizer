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

import { logger, Project, RepoId } from "@atomist/automation-client";
import { Interpretation, ProjectAnalysis, ProjectAnalyzer } from "@atomist/sdm-pack-analysis";
import { PersistResult, ProjectAnalysisResultStore } from "../persist/ProjectAnalysisResultStore";
import { SpideredRepo } from "../SpideredRepo";
import { ScmSearchCriteria } from "./ScmSearchCriteria";
import { ProjectAnalysisResultFilter, SpiderOptions } from "./Spider";

export async function keepExistingPersisted(
    opts: {
        persister: ProjectAnalysisResultStore,
        keepExistingPersisted: ProjectAnalysisResultFilter,
    },
    repoId: RepoId): Promise<boolean> {
    const found = await opts.persister.loadByRepoRef(repoId);
    if (!found) {
        return false;
    }
    return opts.keepExistingPersisted(found);
}

export interface AnalyzeResults {
    repoInfos: RepoInfo[];
    projectsDetected: number;
}

export interface RepoInfo {
    readme: string;
    totalFileCount: number;
    interpretation: Interpretation;
    analysis: ProjectAnalysis;
}
/**
 * Find project or subprojects
 */
export async function analyze(project: Project,
                              analyzer: ProjectAnalyzer,
                              criteria: ScmSearchCriteria): Promise<AnalyzeResults> {
    return { projectsDetected: 1, repoInfos: [await analyzeProject(project, analyzer)] };
}

/**
 * Analyze a project.
 */
async function analyzeProject(project: Project,
                              analyzer: ProjectAnalyzer): Promise<RepoInfo> {
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
    };
}

export async function persistRepoInfo(
    opts: SpiderOptions,
    repoInfo: RepoInfo,
    moreInfo: {
        sourceData: any,
        query?: string,
        timestamp: Date,
        url: string,
    }): Promise<PersistResult> {

    // Use a spread as url has a getter and otherwise disappears
    const repoRef = {
        ...repoInfo.analysis.id,
        url: moreInfo.url,
    };
    const toPersist: SpideredRepo = {
        workspaceId: opts.workspaceId,
        repoRef,
        analysis: {
            ...repoInfo.analysis,
            id: repoRef,
        },
        topics: [], // enriched.interpretation.keywords,
        sourceData: moreInfo.sourceData,
        timestamp: moreInfo.timestamp,
        query: moreInfo.query,
        readme: repoInfo.readme,
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
    return persistResult;
}
