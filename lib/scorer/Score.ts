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

export type FiveStar = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Represents a quality ranking of a particular element of a project.
 */
export interface Score {

    readonly name: string;

    /**
     * Category this score belongs to, if any
     */
    readonly category?: string;

    /**
     * Explanation for this score, if available
     */
    readonly reason?: string;

    readonly score: FiveStar;

}

/**
 * Structure representing a score on a particular aspect of a project.
 */
export type Scores = Record<string, Score>;

export type Weighting = 1 | 2 | 3;

export interface Scored {
    readonly scores: Scores;
}

/**
 * Score the given object in the given context
 * @param scoreFunctions scoring functions. Undefined returns will be ignored
 * @param {T} toScore what to score
 * @param {CONTEXT} context
 * @return {Promise<Scores>}
 */
export async function scoresFor<T, CONTEXT>(scoreFunctions: Array<(t: T, c: CONTEXT) => Promise<Score | undefined>>,
                                            toScore: T,
                                            context: CONTEXT): Promise<Scores> {
    const scores: Scores = {};
    for (const scorer of scoreFunctions) {
        const score = await scorer(toScore, context);
        if (score) {
            scores[score.name] = score;
        }
    }
    return scores;
}

/**
 * Weighting to apply to this name score. Default is 1.
 * Other values can be used to increase the weighting.
 */
export type ScoreWeightings = Record<string, Weighting>;

export type WeightedScores = Record<string, Score & { weighting: Weighting }>;

export interface WeightedScore {

    /**
     * Weighted score
     */
    weightedScore: number;

    /**
     * Individual component scores
     */
    weightedScores: WeightedScores;
}

/**
 * Perform a weighted composite score for the given scores.
 * Returns a real number from 0 to 5
 */
export function weightedCompositeScore(scored: Scored,
                                       weightings: ScoreWeightings = {}): WeightedScore | undefined {
    const keys = Object.getOwnPropertyNames(scored.scores);
    if (keys.length === 0) {
        return undefined;
    }

    const weightedScores: WeightedScores = {};
    let compositeScore: number = 0.0;
    let divideBy = 0;
    const scores = keys.map(k => scored.scores[k]);
    for (const score of scores) {
        const weighting = weightings[score.name] || 1;
        weightedScores[score.name] = {
            ...score,
            weighting,
        };
        compositeScore += score.score * weighting;
        divideBy += weighting;
    }
    const weightedScore = compositeScore / divideBy;
    return {
        weightedScore,
        weightedScores,
    };
}
