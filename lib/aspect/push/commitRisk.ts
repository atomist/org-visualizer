import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprints";
import { Score, Scored, Scores, scoresFor, ScoreWeightings, weightedCompositeScore } from "@atomist/sdm-pack-aspect";
import { PushImpactListenerInvocation } from "@atomist/sdm";
import { GitProject } from "@atomist/automation-client";

export interface CommitRiskData {

    /**
     * Score out of five
     */
    score: number;
}

export type CommitRiskScorer = (pli: PushImpactListenerInvocation) => Promise<Score>;

/**
 * Calculate the risk of this compute with the given scorers, which should return a
 * score from 1 (low) to 5 (high).
 */
export function commitRisk(opts: {
    scorers: CommitRiskScorer[],
    scoreWeightings?: ScoreWeightings,
}): Aspect<CommitRiskData> {
    return {
        name: "commit-risk",
        displayName: "commit-risk",
        extract: async (p, pli) => {
            const scores: Scores = await scoresFor(opts.scorers, {
                ...pli,
                project: p as GitProject,
            }, p);
            const scored: Scored = { scores };
            const score = weightedCompositeScore(scored, opts.scoreWeightings);
            return fingerprintOf({
                type: "commit-risk",
                data: {
                    score: score.weightedScore,
                },
            });
        },
        toDisplayableFingerprint: fp => "Risk: " + fp.data.score,
    }
}