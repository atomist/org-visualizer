import { ManagedFingerprint, ManagedFingerprints } from "../FeatureManager";
import * as _ from "lodash";

export function relevantFingerprints(mfs: ManagedFingerprints, test: (mf: ManagedFingerprint) => boolean): ManagedFingerprints {
    const clone: ManagedFingerprints = _.cloneDeep(mfs);
    for (const featureAndFingerprints of clone.features) {
        featureAndFingerprints.fingerprints = featureAndFingerprints.fingerprints.filter(test);
        if (featureAndFingerprints.feature.toDisplayableFingerprintName) {
            for (const fp of featureAndFingerprints.fingerprints) {
                (fp as any).displayName = featureAndFingerprints.feature.toDisplayableFingerprintName(fp.name);
            }
        }
    }
    clone.features = clone.features.filter(f => f.fingerprints.length > 0);
    return clone;
}

export function allManagedFingerprints(mfs: ManagedFingerprints): ManagedFingerprint[] {
    return _.uniqBy(_.flatMap(mfs.features, f => f.fingerprints), mf => mf.name);
}