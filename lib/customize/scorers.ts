import { FiveStar } from "@atomist/sdm-pack-analysis";
import { BranchCountType } from "../aspect/git/branchCount";
import { RepositoryScorer } from "../scorer/scoring";

export const Scorers: RepositoryScorer[] = [
    async repo => {
        const branchCount = repo.analysis.fingerprints.find(f => f.type === BranchCountType);
        if (!branchCount) {
            return undefined;
        }
        let score: FiveStar = 5;
        const demerits = Math.min(branchCount.data.count % 5, 4);
        score = score - demerits as FiveStar;
        return branchCount ? {
            name: BranchCountType,
            score,
        } : undefined;
    },
    async repo => {
        let score: any = 5;
        const err = repo.tags.filter(t => t.severity === "error");
        const warn = repo.tags.filter(t => t.severity === "warn");
        score -= 3 * err.length;
        score -= 2 * warn.length;
        score = Math.max(score, 1) as FiveStar;
        return {
            name: "sev-count",
            score,
        };
    },
];
