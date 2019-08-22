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
    Aspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import {
    AspectRegistry,
    CombinationTagger,
    isTagger,
    RepositoryScorer,
    ScoredRepo,
    Tag,
    TaggedRepo,
    Tagger,
    TaggerDefinition,
    WorkspaceSpecificTagger,
} from "./AspectRegistry";

import { RemoteRepoRef } from "@atomist/automation-client";
import * as _ from "lodash";
import { Error } from "tslint/lib/error";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { TagContext } from "../routes/api";
import { ScoreWeightings } from "../scorer/Score";
import {
    scoreRepos,
} from "../scorer/scoring";
import { showTiming } from "../util/showTiming";
import { IdealStore } from "./IdealStore";
import {
    chainUndesirableUsageCheckers,
    ProblemStore,
    problemStoreBackedUndesirableUsageCheckerFor,
    UndesirableUsageChecker,
} from "./ProblemStore";

export class DefaultAspectRegistry implements AspectRegistry {

    private readonly taggers: TaggerDefinition[] = [];

    private readonly combinationTaggers: CombinationTagger[] = [];

    /**
     * Add a tagger that will work on all repositories.
     */
    public withTaggers(...taggers: TaggerDefinition[]): this {
        this.taggers.push(...taggers);
        return this;
    }

    public withCombinationTaggers(...taggers: CombinationTagger[]): this {
        this.combinationTaggers.push(...taggers);
        return this;
    }

    private combinationTagsFor(fps: FP[], id: RemoteRepoRef, tagContext: TagContext): Tag[] {
        return _.uniqBy(this.combinationTaggers
                .map(tagger => ({ ...tagger, tag: tagger.test(fps, id, tagContext) }))
                .filter(t => !!t.tag),
            tag => tag.name);
    }

    public async tagAndScoreRepos(workspaceId: string, repos: ProjectAnalysisResult[]): Promise<ScoredRepo[]> {
        const scored = await showTiming(`Tag and score ${repos.length} repos`,
            async () => scoreRepos(
                this.scorers,
                await this.tagRepos({
                    repoCount: repos.length,
                    // TODO fix this
                    averageFingerprintCount: -1,
                    workspaceId,
                    aspectRegistry: this,
                }, repos),
                this.opts.scoreWeightings));
        return scored;
    }

    get availableTags(): Tag[] {
        return _.uniqBy(
            [...this.taggers, ...this.combinationTaggers],
            tag => tag.name);
    }

    get aspects(): Aspect[] {
        return this.opts.aspects;
    }

    public aspectOf(type: string): Aspect | undefined {
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

    private async tagRepos(tagContext: TagContext,
                           repos: ProjectAnalysisResult[]): Promise<TaggedRepo[]> {
        const simpleTaggers = this.taggers.filter(isTagger);
        const workspaceSpecificTaggers = await Promise.all(this.taggers
            .filter(td => !isTagger(td))
            // TODO why is this cast needed?
            .map(td => (td as WorkspaceSpecificTagger).create(tagContext.workspaceId, this)));
        const taggersToUse = [...simpleTaggers, ...workspaceSpecificTaggers];
        return Promise.all(repos.map(repo => this.tagRepo(tagContext, repo, taggersToUse)));
    }

    private async tagRepo(
        tagContext: TagContext,
        repo: ProjectAnalysisResult,
        taggers: Tagger[]): Promise<TaggedRepo> {
        return {
            ...repo,
            tags: (await tagsIn(repo.analysis.fingerprints, repo.repoRef, tagContext, taggers))
                .concat(this.combinationTagsFor(repo.analysis.fingerprints, repo.repoRef, tagContext)),
        };
    }

    constructor(private readonly opts: {
        idealStore: IdealStore,
        problemStore: ProblemStore,
        aspects: Aspect[],
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

export function defaultedToDisplayableFingerprintName(aspect?: Aspect): (fingerprintName: string) => string {
    return (aspect && aspect.toDisplayableFingerprintName) || (name => name);
}

export function defaultedToDisplayableFingerprint(aspect?: Aspect): (fpi: FP) => string {
    return (aspect && aspect.toDisplayableFingerprint) || (fp => fp && fp.data);
}

function tagsFor(fp: FP, id: RemoteRepoRef, tagContext: TagContext, taggers: Tagger[]): Tag[] {
    return _.uniqBy(taggers
            .map(tagger => ({ ...tagger, tag: tagger.test(fp, id, tagContext) }))
            .filter(t => !!t.tag),
        tag => tag.name);
}

async function tagsIn(fps: FP[], id: RemoteRepoRef, tagContext: TagContext, taggersToUse: Tagger[]): Promise<Tag[]> {
    return _.uniqBy(_.flatten(fps.map(fp => tagsFor(fp, id, tagContext, taggersToUse))), tag => tag.name)
        .sort();
}
