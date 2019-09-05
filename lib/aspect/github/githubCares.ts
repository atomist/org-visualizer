import { Tagger } from "@atomist/sdm-pack-aspect";
import { isGitHubFingerprint } from "./githubAspect";

export function gitHubCares(opts: { minStars: number }): Tagger {
    return {
        name: `stars>${opts.minStars}`,
        description: `GitHub cares: > ${opts.minStars} stars`,
        test: async rts => {
            const found = rts.analysis.fingerprints
                .filter(isGitHubFingerprint)
                .find(fp => fp.name === "stars");
            return found && found.data.count > opts.minStars;
        },
    }
}