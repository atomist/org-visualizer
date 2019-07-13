import { FP } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { FingerprintKind, ProjectAnalysisResultStore } from "../persist/ProjectAnalysisResultStore";

/**
 * Retrieve all fingerprints, then compute and store fingerprint_analytics for the whole workspace
 */
export async function computeAnalytics(persister: ProjectAnalysisResultStore, workspaceId: string): Promise<void> {
    const allFingerprints = await persister.fingerprintsInWorkspace(workspaceId);
    const fingerprintKinds = await persister.distinctFingerprintKinds(workspaceId);

    await Promise.all(fingerprintKinds.map(async (kind: FingerprintKind) => {
        const fingerprintsOfKind = allFingerprints.filter(f => f.type === kind.type && f.name === kind.name);
        const cohortAnalysis = analyzeCohort(fingerprintsOfKind);
        return persister.persistAnalytics(workspaceId, kind, cohortAnalysis);
    }));
}

/**
 * Calculate and persist entropy for one fingerprint kind
 * @param {ClientFactory} clientFactory
 * @param {string} workspaceId
 * @param {string} type
 * @param {string} name
 * @return {Promise<void>}
 */
export async function computeAnalyticsForFingerprintKind(persister: ProjectAnalysisResultStore,
                                                         workspaceId: string,
                                                         type: string,
                                                         name: string): Promise<void> {
    const fingerprints = await persister.fingerprintsInWorkspace(workspaceId, type, name);
    const cohortAnalysis = analyzeCohort(fingerprints);
    await persister.persistAnalytics(workspaceId, { type, name }, cohortAnalysis);
}

export interface CohortAnalysis {
    count: number;
    variants: number;
    entropy: number;
}

/**
 * Analyze a cohort of the same kind of fingerprints
 * @param {() => Promise<FP[]>} typeAndNameQuery
 * @return {Promise<CohortAnalysis>}
 */
function analyzeCohort(fps: FP[]): CohortAnalysis {
    const groups: Record<string, FP[]> = _.groupBy(fps, fp => fp.sha);
    const total: number = fps.length;
    const entropy = -1 * Object.values(groups).reduce(
        (agg, fp: FP[]) => {
            const p: number = fp.length / total;
            return agg + p * Math.log(p);
        },
        0,
    );
    return { entropy, variants: Object.values(groups).length, count: fps.length };
}
