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
    BaseAspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import {
    AspectRegistry, CombinationTagger,
    ManagedAspect,
    RepositoryScorer,
    ScoredRepo,
    Tag,
    TaggedRepo, Tagger,
} from "./AspectRegistry";

import { RemoteRepoRef } from "@atomist/automation-client";
import { ScoreWeightings } from "@atomist/sdm-pack-analysis";
import * as _ from "lodash";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { TagContext } from "../routes/api";
import {
    scoreRepos,
} from "../scorer/scoring";
import { IdealStore } from "./IdealStore";
import {
    chainUndesirableUsageCheckers,
    ProblemStore,
    problemStoreBackedUndesirableUsageCheckerFor,
    UndesirableUsageChecker,
} from "./ProblemStore";

/**
 * Aspects must have unique names
 */
export class DefaultAspectRegistry implements AspectRegistry {

    private readonly taggers: Tagger[] = [];

    private readonly combinationTaggers: CombinationTagger[] = [];

    /**
     * Create an index on this aspect. Must return a unique string. It's associated with a usage
     * not an aspect.
     */
    public withTaggers(...taggers: Tagger[]): this {
        this.taggers.push(...taggers);
        return this;
    }

    public withCombinationTaggers(...taggers: CombinationTagger[]): this {
        this.combinationTaggers.push(...taggers);
        return this;
    }

    private tagsFor(fp: FP, id: RemoteRepoRef, tagContext: TagContext): Tag[] {
        return _.uniqBy(this.taggers
                .map(tagger => ({ ...tagger, tag: tagger.test(fp, id, tagContext) }))
                .filter(t => !!t.tag),
            tag => tag.name);
    }

    private combinationTagsFor(fps: FP[], id: RemoteRepoRef, tagContext: TagContext): Tag[] {
        return _.uniqBy(this.combinationTaggers
                .map(tagger => ({ ...tagger, tag: tagger.test(fps, id, tagContext) }))
                .filter(t => !!t.tag),
            tag => tag.name);
    }

    public async tagAndScoreRepos(workspaceId: string, repos: ProjectAnalysisResult[]): Promise<ScoredRepo[]> {
        return scoreRepos(
            this.scorers,
            this.tagRepos({
                repoCount: repos.length,
                // TODO fix this
                averageFingerprintCount: -1,
                workspaceId,
                aspectRegistry: this,
            }, repos),
            this.opts.scoreWeightings);
    }

    get availableTags(): Tag[] {
        return _.uniqBy(
            [...this.taggers, ...this.combinationTaggers],
            tag => tag.name);
    }

    get aspects(): ManagedAspect[] {
        return this.opts.aspects;
    }

    public aspectOf(type: string): ManagedAspect | undefined {
        return type ? this.aspects.find(f => f.name === type) : undefined;
    }

    public async undesirableUsageCheckerFor(workspaceId: string): Promise<UndesirableUsageChecker> {
        // TODO going for check functions is inelegant
        return chainUndesirableUsageCheckers(
            (await problemStoreBackedUndesirableUsageCheckerFor(this.problemStore, workspaceId)).check,
            this.opts.undesirableUsageChecker.check);
    }

    get idealStore(): IdealStore {
        return this.opts.idealStore;
    }

    get problemStore(): ProblemStore {
        return this.opts.problemStore;
    }

    get scorers(): RepositoryScorer[] {
        return this.opts.scorers || [];
    }

    private tagRepos(tagContext: TagContext,
                     repos: ProjectAnalysisResult[]): TaggedRepo[] {
        return repos.map(repo => this.tagRepo(tagContext, repo));
    }

    private tagRepo(
        tagContext: TagContext,
        repo: ProjectAnalysisResult): TaggedRepo {
        return {
            ...repo,
            tags: this.tagsIn(repo.analysis.fingerprints, repo.repoRef, tagContext)
                .concat(this.combinationTagsFor(repo.analysis.fingerprints, repo.repoRef, tagContext)),
        };
    }

    private tagsIn(fps: FP[], id: RemoteRepoRef, tagContext: TagContext): Tag[] {
        return _.uniqBy(_.flatten(fps.map(fp => this.tagsFor(fp, id, tagContext))), tag => tag.name)
            .sort();
    }

    constructor(private readonly opts: {
        idealStore: IdealStore,
        problemStore: ProblemStore,
        aspects: ManagedAspect[],
        undesirableUsageChecker: UndesirableUsageChecker,
        scorers?: RepositoryScorer[],
        scoreWeightings?: ScoreWeightings,
    }) {
        opts.aspects.forEach(f => {
            if (!f) {
                throw new Error("A null aspect was passed in");
            }
        });
    }
}

export function defaultedToDisplayableFingerprintName(aspect?: BaseAspect): (fingerprintName: string) => string {
    return (aspect && aspect.toDisplayableFingerprintName) || (name => name);
}

export function defaultedToDisplayableFingerprint(aspect?: BaseAspect): (fpi: FP) => string {
    return (aspect && aspect.toDisplayableFingerprint) || (fp => fp && fp.data);
}
