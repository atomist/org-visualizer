import { DerivedFeature, Feature, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { HasFingerprints } from "../FeatureManager";
import { allFingerprints } from "../DefaultFeatureManager";

// TODO move to fingerprints pack

/**
 * Feature that is satisfied by at least one of these fingerprints.
 * For example, is there CI? This may be satisfied by a
 * Jenkins, Circle or Travis fingerprint.
 * Such features are not applicable.
 * @param name name of this fingerprint
 * @param opts feature fields
 * @param names fingerprint names
 * @return {Feature}
 */
export function oneOf(
    name: string,
    opts: Pick<Feature, "displayName" | "toDisplayableFingerprint" | "toDisplayableFingerprintName">,
    ...names: string[]): DerivedFeature<HasFingerprints> {
    return {
        ...opts,
        derive: async hf => {
            const qualifyingFingerprints: FP[] = [];
            for (const fp of allFingerprints(hf)) {
                if (names.includes(fp.name)) {
                    qualifyingFingerprints.push(fp);
                }
            }
            return qualifyingFingerprints.length > 0 ?
                {
                    name,
                    abbreviation: name,
                    version: "0.1.0",
                    data: qualifyingFingerprints,
                    sha: sha256(JSON.stringify(qualifyingFingerprints)),
                } :
                undefined;
        },
        apply: undefined,
        selector: fp => fp.name === name,
    };
}
