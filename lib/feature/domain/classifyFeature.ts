import { Feature, sha256 } from "@atomist/sdm-pack-fingerprints";
import { Project } from "@atomist/automation-client";

export interface Classifier {
    classification: string;
    predicate: (p: Project) => Promise<boolean>;
}

/**
 *
 * @param {Pick<Feature, "name" | "displayName"> & {fallbackClassification?: string}} id Fallback classification can be
 * undefined to return no fingerprint
 * @param {Classifier} classifiers
 * @return {Feature}
 */
export function classifyFeature(id: Pick<Feature, "name" | "displayName"> & { fallbackClassification: string },
                                ...classifiers: Classifier[]): Feature {
    return {
        ...id,
        extract: async p => {
            let data = id.fallbackClassification;
            for (const classifier of classifiers) {
                if (await classifier.predicate(p)) {
                    data = classifier.classification;
                    break;
                }
            }
            return !!data ? {
                    name: id.name,
                    type: id.name,
                    data,
                    sha: sha256(data),
                } :
                undefined;
        },
        selector: fp => fp.name === id.name,

    };
}