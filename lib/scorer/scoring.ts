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
    Score,
    scoresFor,
    ScoreWeightings,
    weightedCompositeScore,
} from "@atomist/sdm-pack-analysis";
import { AspectRegistry } from "../aspect/AspectRegistry";
import { TaggedRepo } from "../routes/support/tagUtils";

export type RepositoryScorer = (r: TaggedRepo, ctx: any) => Promise<Score | undefined>;

export type ScoredRepo = TaggedRepo & { score: number };

export async function scoreRepos(aspectRegistry: AspectRegistry,
                                 repos: TaggedRepo[]): Promise<ScoredRepo[]> {
    return Promise.all(repos.map(repo => scoreRepo(aspectRegistry.scorers, repo)
        .then(score => ({
            ...repo,
            score,
        }))));
}

/**
 * Score the repo
 */
export async function scoreRepo(scorers: RepositoryScorer[],
                                repo: TaggedRepo,
                                weightings?: ScoreWeightings): Promise<number> {
    const scores = await scoresFor(scorers, repo, undefined);
    return weightedCompositeScore({ scores }, weightings);
}
