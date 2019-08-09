import { Score, scoresFor, ScoreWeightings, weightedCompositeScore } from "@atomist/sdm-pack-analysis";
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
