import { PublishFingerprints } from "@atomist/sdm-pack-fingerprint";
import { ProjectAnalysisResultStore } from "@atomist/sdm-pack-aspect/lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { sendFingerprintsToAtomist } from "@atomist/sdm-pack-fingerprint/lib/adhoc/fingerprints";
import { storeFingerprints } from "@atomist/sdm-pack-aspect/lib/aspect/delivery/storeFingerprintsPublisher";

/**
 * Store
 * @param {ProjectAnalysisResultStore} store
 * @return {PublishFingerprints}
 */
export function sendFingerprintsEverywhere(store: ProjectAnalysisResultStore): PublishFingerprints {
    const here = storeFingerprints(store);
    const there = sendFingerprintsToAtomist;
    return async (i, fps, previous)=> {
        await here(i, fps, previous);
        return there(i, fps, previous);
    };
}