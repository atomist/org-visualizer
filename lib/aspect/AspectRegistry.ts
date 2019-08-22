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
    RemoteRepoRef,
    Severity,
} from "@atomist/automation-client";
import {
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { Aspect } from "@atomist/sdm-pack-fingerprints/lib/machine/Aspect";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { TagContext } from "../routes/api";
import {
    Score,
    WeightedScore,
} from "../scorer/Score";
import { IdealStore } from "./IdealStore";
import {
    ProblemStore,
    UndesirableUsageChecker,
} from "./ProblemStore";

/**
 * Implemented by ProjectAnalysis or any other structure
 * representing a repo exposing fingerprint data
 */
export interface HasFingerprints {
    fingerprints: FP[];
}

/**
 * Result of an analysis. We must always have at least fingerprints and repo identification
 */
export type Analyzed = HasFingerprints & { id: RemoteRepoRef };

/**
 * Tag based on fingerprint data.
 */
export interface Tag {

    name: string;

    description?: string;

    /**
     * Severity if this tag is associated with an action
     */
    severity?: Severity;
}

/**
 * Determine zero or one tag in this fingerprint
 */
export interface Tagger extends Tag {

    /**
     * Test for the relevance of this tag
     * @param {FP} fp fingerprint to test
     * @param {RemoteRepoRef} id id of repo to text
     * @param {TagContext} tagContext context of this cohort of repos
     * @return {boolean}
     */
    test(fp: FP, id: RemoteRepoRef, tagContext: TagContext): boolean;
}

export interface WorkspaceSpecificTagger {
    readonly name: string;

    create(workspaceId: string, ar: AspectRegistry): Promise<Tagger>;
}

/**
 * Tagger that can apply to all workspaces or workspace-specific tagger
 */
export type TaggerDefinition = Tagger | WorkspaceSpecificTagger;

export function isTagger(t: TaggerDefinition): t is Tagger {
    const maybe = t as Tagger;
    return !!maybe.test;
}

/**
 * Determine zero or one tag from this set of fingerprints
 */
export interface CombinationTagger extends Tag {

    /**
     * Test for the relevance of this tag given all fingerprints on this repository
     * @param {FP} fp fingerprint to test
     * @param {RemoteRepoRef} id id of repo to text
     * @param {TagContext} tagContext context of this cohort of repos
     * @return {boolean}
     */
    test(fp: FP[], id: RemoteRepoRef, tagContext: TagContext): boolean;
}

export type TaggedRepo = ProjectAnalysisResult & { tags: Tag[] };

export type ScoredRepo = TaggedRepo & { weightedScore: WeightedScore };

/**
 * Function that knows how to score a repository.
 * @param repo repo we are scoring
 * @param allRepos context of this scoring activity
 * @return undefined if this scorer doesn't know how to score this repository.
 */
export type RepositoryScorer = (repo: TaggedRepo, allRepos: TaggedRepo[]) => Promise<Score | undefined>;

/**
 * Manage a number of aspects.
 */
export interface AspectRegistry {

    tagAndScoreRepos(workspaceId: string, repos: ProjectAnalysisResult[]): Promise<ScoredRepo[]>;

    availableTags: Tag[];

    /**
     * All the aspects we are managing
     */
    readonly aspects: Aspect[];

    /**
     * Find the aspect that manages fingerprints of this type
     */
    aspectOf(type: string): Aspect | undefined;

    /**
     * Function that can resolve ideal status for this aspect
     */
    readonly idealStore: IdealStore;

    readonly problemStore: ProblemStore;

    /**
     * Return an UndesirableUsageChecker for this workspace
     */
    undesirableUsageCheckerFor(workspaceId: string): Promise<UndesirableUsageChecker>;

}
