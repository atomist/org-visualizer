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
    Scores,
    ScoreWeightings,
    weightedCompositeScore,
} from "@atomist/sdm-pack-analysis";
import {
    RepositoryScorer,
    ScoredRepo,
    TaggedRepo,
} from "../aspect/AspectRegistry";

export async function scoreRepos(scorers: RepositoryScorer[],
                                 repos: TaggedRepo[],
                                 weightings: ScoreWeightings): Promise<ScoredRepo[]> {
    return Promise.all(repos.map(repo => scoreRepo(scorers, repo, repos, weightings)));
}

/**
 * Score the repo
 */
export async function scoreRepo(scorers: RepositoryScorer[],
                                repo: TaggedRepo,
                                allRepos: TaggedRepo[],
                                weightings: ScoreWeightings): Promise<ScoredRepo> {
    const scores = await scoresFor(scorers, repo, allRepos);
    return {
        ...repo,
        weightedScore: weightedCompositeScore({ scores }, weightings),
    };
}

/**
 * Score the given object in the given context
 * @param scoreFunctions scoring functions. Undefined returns will be ignored
 * @param {T} toScore what to score
 * @param {CONTEXT} context
 * @return {Promise<Scores>}
 */
async function scoresFor<T, CONTEXT>(scoreFunctions: Array<(t: T, c: CONTEXT) => Promise<Score | undefined>>,
                                     toScore: T,
                                     context: CONTEXT): Promise<Scores> {
    const scores: Scores = {};
    const runFunctions = scoreFunctions.map(scorer => scorer(toScore, context).then(score => {
        if (score) {
            scores[score.name] = score;
        }
    }));
    await Promise.all(runFunctions);
    return scores;
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
