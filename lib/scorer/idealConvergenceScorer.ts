import { Scorer } from "@atomist/sdm-pack-analysis";
import { FeatureManager } from "../feature/FeatureManager";

export function idealConvergenceScorer(fm: FeatureManager): Scorer {
    return async i => {
        const allFingerprintNames = Object.getOwnPropertyNames(i.reason.analysis.fingerprints);
        let correctFingerprints = 0;
        let hasIdeal = 0;
        for (const name of allFingerprintNames) {
            const ideal = await fm.idealResolver(name);
            if (ideal && ideal.ideal) {
                ++hasIdeal;
                if (ideal.ideal.sha === i.reason.analysis.fingerprints[name].sha) {
                    ++correctFingerprints;
                }
            }
        }
        const proportion = hasIdeal > 0 ? correctFingerprints / hasIdeal : 1;
        return {
            name: "ideals",
            score: Math.round(proportion * 5) as any,
        };
    };
}
