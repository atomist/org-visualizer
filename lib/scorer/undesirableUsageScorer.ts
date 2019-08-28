import { adjustBy, ProblemUsage, RepositoryScorer, UndesirableUsageChecker } from "@atomist/sdm-pack-aspect";

import * as _ from "lodash";

/**
 * Penalize repos with undesirable usages.
 * UndesirableUsageChecker must not require workspace id.
 * @param undesirableUsageChecker checker
 */
export function undesirableUsageScorer(undesirableUsageChecker: UndesirableUsageChecker): RepositoryScorer {
    return async (repo, ctx) => {
        const problems: ProblemUsage[] = _.flatten(repo.analysis.fingerprints
            .map(fp => undesirableUsageChecker.check(fp, undefined)));
        let loss = 0;
        for (const problem of problems) {
            switch (problem.severity) {
                case "error":
                    loss += 3;
                    break;
                case "warn":
                    loss += 2;
                    break;
                case "info":
                    loss += 1;
                    break;
            }
        }
        const score = adjustBy(-loss);
        return {
            name: "undesirable-usages",
            reason: _.uniq(problems.map(p => p.description)).join(","),
            score,
        };
    };
}
