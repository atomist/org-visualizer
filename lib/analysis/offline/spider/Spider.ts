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
    logger,
    Project,
} from "@atomist/automation-client";
import { Analyzed } from "../../../aspect/AspectRegistry";
import { ProjectAnalysisResult } from "../../ProjectAnalysisResult";
import { ProjectAnalysisResultStore } from "../persist/ProjectAnalysisResultStore";
import { SpideredRepo } from "../SpideredRepo";
import { ScmSearchCriteria } from "./ScmSearchCriteria";

import * as _ from "lodash";

export type ProjectAnalysisResultFilter = (pa: ProjectAnalysisResult) => Promise<boolean>;

/**
 * Options for spidering source code hosts
 */
export interface SpiderOptions {

    workspaceId: string;

    persister: ProjectAnalysisResultStore;

    poolSize: number;

    /**
     * Is this record OK or should it be refreshed?
     */
    keepExistingPersisted: ProjectAnalysisResultFilter;

    /**
     * Invoked after the repo is persisted to perform any additional actions.
     */
    onPersisted?: (repo: SpideredRepo) => Promise<void>;
}

export type RepoUrl = string;

export type PersistenceResult = string; // filename

export interface SpiderFailure {
    repoUrl: string;
    whileTryingTo: string;
    message: string;
}

export interface SpiderResult {
    repositoriesDetected: number;
    projectsDetected: number;
    failed: SpiderFailure[];
    keptExisting: RepoUrl[];
    persistedAnalyses: PersistenceResult[];
}

export const EmptySpiderResult: SpiderResult = {
    repositoriesDetected: 0,
    projectsDetected: 0,
    failed: [],
    keptExisting: [],
    persistedAnalyses: [],
};

export interface Timing {
    totalMillis: number;
    extractions: number;
}

/**
 * Aspect type to total time taken to extract it
 */
export type TimeRecorder = Record<string, Timing>;

export interface Analyzer {

    analyze(p: Project): Promise<Analyzed>;

    readonly timings: TimeRecorder;
}

export function logTimings(recorder: TimeRecorder): void {
    const timings: Array<Timing & { name: string }> = Object.getOwnPropertyNames(recorder)
        .map(name => ({
            name,
            ...recorder[name],
        }));
    const totalSeconds = _.sum(timings.map(t => t.totalMillis)) / 1000;
    const sorted = _.sortBy(timings, t => -t.totalMillis);
    logger.info("Aspect extraction total so far: %d seconds...", totalSeconds);
    logger.info("\t" + sorted.map(s => `${s.name}: ${s.totalMillis / 1000} seconds`).join("\n\t"));
}

/**
 * Spider a data source and progressively persist what we find.
 */
export interface Spider {

    spider(criteria: ScmSearchCriteria,
           analyzer: Analyzer,
           opts: SpiderOptions): Promise<SpiderResult>;
}
