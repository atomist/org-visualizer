/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FP } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import {
    FingerprintKind,
    ProjectAnalysisResultStore,
} from "../persist/ProjectAnalysisResultStore";

/**
 * Retrieve all fingerprints, then compute and store fingerprint_analytics for the whole workspace
 */
export async function computeAnalytics(persister: ProjectAnalysisResultStore, workspaceId: string): Promise<void> {
    const allFingerprints = await persister.fingerprintsInWorkspace(workspaceId);
    const fingerprintKinds = await persister.distinctFingerprintKinds(workspaceId);

    const persistThese = fingerprintKinds.map((kind: FingerprintKind) => {
        const fingerprintsOfKind = allFingerprints.filter(f => f.type === kind.type && f.name === kind.name);
        const cohortAnalysis = analyzeCohort(fingerprintsOfKind);
        return { workspaceId, kind, cohortAnalysis };
    });

    await persister.persistAnalytics(persistThese);
}

/**
 * Calculate and persist entropy for one fingerprint kind
 */
export async function computeAnalyticsForFingerprintKind(persister: ProjectAnalysisResultStore,
                                                         workspaceId: string,
                                                         type: string,
                                                         name: string): Promise<void> {
    const fingerprints = await persister.fingerprintsInWorkspace(workspaceId, type, name);
    const cohortAnalysis = analyzeCohort(fingerprints);
    await persister.persistAnalytics([{ workspaceId, kind: { type, name }, cohortAnalysis }]);
}

/**
 * Result of analyzing a cohort of fingerprints.
 */
export interface CohortAnalysis {
    count: number;
    variants: number;
    entropy: number;
}

/**
 * Analyze a cohort of the same kind of fingerprints
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
