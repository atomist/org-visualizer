import { adjustBy } from "@atomist/sdm-pack-aspect";
import { CommitRiskScorer } from "./commitRisk";

export function fileChangeCount(opts: { limitTo: number }): CommitRiskScorer {
    return async pili => ({
        name: "files-changed",
        score: adjustBy(pili.filesChanged ? pili.filesChanged.length / opts.limitTo : 0, 1),
    });
}

export function pomChanged(): CommitRiskScorer {
    return async pili => ({
        name: "pom-changed",
        score: pili.filesChanged && pili.filesChanged.includes("pom.xml") ? 5 : 1,
    });
}