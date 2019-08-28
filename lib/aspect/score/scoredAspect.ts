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

import { PushImpactListenerInvocation } from "@atomist/sdm";
import { Score, Scored, Scores, scoresFor, ScoreWeightings, weightedCompositeScore } from "@atomist/sdm-pack-aspect";
import { AspectMetadata } from "@atomist/sdm-pack-aspect/lib/aspect/compose/commonTypes";
import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprints";

export interface ScoreData {

    /**
     * Score out of five
     */
    score: number;
}

/**
 * Asoect that scores pushs or projects
 */
export type ScoredAspect = Aspect<ScoreData>;

/**
 * Score the project and the push
 */
export type PushScorer = (pili: PushImpactListenerInvocation) => Promise<Score>;

/**
 * Calculate the risk of this compute with the given scorers, which should return a
 * score from 1 (low) to 5 (high).
 */
export function scoredAspect(opts: {
    scorers: PushScorer[],
    scoreWeightings?: ScoreWeightings,
} & AspectMetadata): ScoredAspect {
    return {
        extract: async (p, pili) => {
            const scores: Scores = await scoresFor(opts.scorers, pili, p);
            const scored: Scored = { scores };
            const score = weightedCompositeScore(scored, opts.scoreWeightings);
            return fingerprintOf({
                type: opts.name,
                data: {
                    score: score.weightedScore,
                },
            });
        },
        stats: {
            defaultStatStatus: {
                entropy: false,
            },
            basicStatsPath: "score",
        },
        ...opts,
    };
}
