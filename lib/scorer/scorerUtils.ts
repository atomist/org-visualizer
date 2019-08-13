import { RepositoryScorer } from "../aspect/AspectRegistry";
import { isGlobMatchFingerprint } from "../aspect/compose/globAspect";

export function requireAspectOfType(opts: { type: string, reason: string }): RepositoryScorer {
    return async repo => {
        const found = repo.analysis.fingerprints.find(fp => fp.type === opts.type);
        return {
            name: `${opts.type}-required`,
            score: !!found ? 5 : 1,
            reason: !found ? opts.reason : "Satisfactory",
        };
    };
}

/**
 * Must exactly match the glob pattern
 * @param {{glob: string}} opts
 * @return {RepositoryScorer}
 */
export function requireGlobAspect(opts: { glob: string }): RepositoryScorer {
    return async repo => {
        const globs = repo.analysis.fingerprints.filter(isGlobMatchFingerprint);
        const found = globs.filter(gf => gf.data.glob === opts.glob);
        return {
            name: `${opts.glob}-required`,
            score: !!found ? 5 : 1,
            reason: !found ? `Should have file for ${opts.glob}` : "Satisfactory",
        };
    };
}
