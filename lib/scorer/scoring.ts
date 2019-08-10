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
    FiveStar,
    Score,
    Scorer,
    Scores,
    scoresFor,
    ScoreWeightings,
    weightedCompositeScore,
    WeightedScore,
    WeightedScores,
} from "@atomist/sdm-pack-analysis";
import { AspectRegistry } from "../aspect/AspectRegistry";
import { TaggedRepo } from "../routes/support/tagUtils";

export type RepositoryScorer = (r: TaggedRepo, ctx: any) => Promise<Score | undefined>;

export type ScoredRepo = TaggedRepo & { weightedScore: WeightedScore };

export async function scoreRepos(scorers: RepositoryScorer[],
                                 repos: TaggedRepo[],
                                 weightings: ScoreWeightings): Promise<ScoredRepo[]> {
    return Promise.all(repos.map(repo => scoreRepo(scorers, repo, weightings)));
}

/**
 * Score the repo
 */
export async function scoreRepo(scorers: RepositoryScorer[],
                                repo: TaggedRepo,
                                weightings: ScoreWeightings): Promise<ScoredRepo> {
    const scores = await scoresFor(scorers, repo, weightings);
    return {
        ...repo,
        weightedScore: weightedCompositeScore({ scores }, weightings),
    };
}

/**
 * If merits is negative, reduce
 * @param {number} merits
 * @param {FiveStar} startAt
 * @return {FiveStar}
 */
export function adjustBy(merits: number, startAt: FiveStar = 5): FiveStar {
    const score = startAt + merits;
    return Math.min(Math.max(score, 1), 5) as FiveStar;
}
