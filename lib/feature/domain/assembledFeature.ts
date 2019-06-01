import { DerivedFeature, Feature, sha256 } from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";

import * as _ from "lodash";

/**
 * Function or path within ProjectAnalysis structure
 */
export type Extractor = ((pa: ProjectAnalysis) => any) | string;

export function assembledFeature(
    name: string,
    opts: Pick<Feature, "displayName" | "toDisplayableFingerprint" | "toDisplayableFingerprintName">,
    ...extractors: Extractor[]): DerivedFeature<ProjectAnalysis> {
    return {
        ...opts,
        derive: async pa => {
            const qualifyingPathValues = [];
            for (const extractor of extractors) {
                const value = applyExtractor(extractor, pa);
                if (!!value) {
                    qualifyingPathValues.push(value);
                }
            }
            return qualifyingPathValues.length > 0 ?
                {
                    name,
                    abbreviation: name,
                    version: "0.1.0",
                    data: qualifyingPathValues,
                    sha: sha256(JSON.stringify(qualifyingPathValues)),
                } :
                undefined;
        },
        apply: undefined,
        selector: fp => fp.name === name,
    };
}

function applyExtractor(extractor: Extractor, pa: ProjectAnalysis): any {
    return typeof extractor === "string" ?
        _.get(pa, extractor) :
        extractor(pa);
}
