
import { PushImpactListenerInvocation } from "@atomist/sdm";
import { Score, Scored, Scores, scoresFor, ScoreWeightings, weightedCompositeScore } from "@atomist/sdm-pack-aspect";
import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprints";
import { AspectMetadata } from "@atomist/sdm-pack-aspect/lib/aspect/compose/commonTypes";

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
