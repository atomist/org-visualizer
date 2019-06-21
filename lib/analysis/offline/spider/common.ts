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
    RepoId,
} from "@atomist/automation-client";
import { isInMemoryProject } from "@atomist/automation-client/lib/project/mem/InMemoryProject";
import {
    Interpretation,
    ProjectAnalysis,
    ProjectAnalyzer,
} from "@atomist/sdm-pack-analysis";
import * as path from "path";
import { SubprojectDescription } from "../../ProjectAnalysisResult";
import { SubprojectStatus } from "../../subprojectFinder";
import {
    PersistResult,
    ProjectAnalysisResultStore,
} from "../persist/ProjectAnalysisResultStore";
import { SpideredRepo } from "../SpideredRepo";
import { ScmSearchCriteria } from "./ScmSearchCriteria";
import {
    ProjectAnalysisResultFilter,
    SpiderOptions,
} from "./Spider";

export async function keepExistingPersisted(
    opts: {
        persister: ProjectAnalysisResultStore,
        keepExistingPersisted: ProjectAnalysisResultFilter,
    },
    repoId: RepoId): Promise<boolean> {

    const found = await opts.persister.loadOne(repoId);
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
    subproject: SubprojectDescription;
}
/**
 * Find project or subprojects
 */
export async function analyze(project: Project,
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

async function projectUnder(p: Project, pathWithin: string): Promise<Project> {
    if (isInMemoryProject(p)) {
        // TODO we need latest automation-client but this isn't available
        // return p.toSubproject(pathWithin);
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

export async function persistRepoInfo(
    opts: SpiderOptions,
    repoInfo: RepoInfo,
    moreInfo: {
        sourceData: any,
        query?: string,
        timestamp: Date,
        url: string,
    }): Promise<PersistResult> {
    const toPersist: SpideredRepo = {
        workspaceId: opts.workspaceId,
        analysis: {
            // Use a spread as url has a getter and otherwise disappears
            ...repoInfo.analysis,
            id: {
                ...repoInfo.analysis.id,
                url: moreInfo.url,
            },
        },
        topics: [], // enriched.interpretation.keywords,
        sourceData: moreInfo.sourceData,
        timestamp: moreInfo.timestamp,
        query: moreInfo.query,
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
    return persistResult;
}
