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

import { RemoteRepoRef } from "@atomist/automation-client";
import {
    AtomicFeature,
    Feature,
    FP, Ideal,
    PossibleIdeal,
} from "@atomist/sdm-pack-fingerprints";

/**
 * Function that can return the desired ideal, if any, for a given fingerprint name.
 * While a Feature can suggest multiple ideals in the suggestedIdeals method,
 * there can only be one ideal recommended at any time.
 */
export interface IdealStore {

    storeIdeal(workspaceId: string, ideal: Ideal): Promise<void>;

    fetchIdeal(workspaceId: string, type: string, name: string): Promise<Ideal | undefined>;
}

/**
 * Function that can flag an issue with a fingerprint
 */
export type UndesirableUsageChecker = (fp: FP) => Promise<UndesirableUsage | UndesirableUsage[]>;

/**
 * Report on use of a fingerprint across a cohort of projects
 */
export interface AggregateFingerprintStatus {

    /**
     * Feature that owns this fingerprint
     */
    readonly featureName: string;

    /**
     * Feature type (featureName)
     */
    readonly type: string;

    /**
     * A nice name for display
     */
    readonly displayName: string;

    /**
     * Fingerprint name
     */
    readonly name: string;

    /**
     * Number of projects this fingerprint appears in
     */
    readonly appearsIn: number;

    readonly ideal: PossibleIdeal & { displayValue: string };

    /**
     * Number of variants of this fingerprint across the cohort
     */
    readonly variants: number;
}

export interface FingerprintsWithManagingFeature<ProcessedFingerprint> {
    feature: ManagedFeature;
    fingerprints: ProcessedFingerprint[];
}

/**
 * Report on feature usage in a cohort of projects
 */
export interface FingerprintCensus {

    readonly projectsAnalyzed: number;

    /**
     * Array of features with data about fingerprints they manage
     */
    features: Array<FingerprintsWithManagingFeature<AggregateFingerprintStatus>>;

}

/**
 * Implemented by ProjectAnalysis or any other structure
 * representing a repo exposing fingerprint data
 */
export interface HasFingerprints {
    fingerprints: FP[];
}

/**
 * Result of an analysis. We must always have at least fingerprints and repo identification
 */
export type Analyzed = HasFingerprints & { id: RemoteRepoRef };

/**
 * Type of feature we can manage
 */
export type ManagedFeature<FPI extends FP = FP> = Feature<FPI> | AtomicFeature<FPI>;

/**
 * Flag for an undesirable usage
 */
export interface UndesirableUsage {

    readonly severity: "error" | "warn";

    /**
     * Authority this comes from
     */
    readonly authority: string;

    /**
     * Message to the user
     */
    readonly message: string;

    /**
     * URL associated with this if one is available.
     * For example, a security advisory.
     */
    readonly url?: string;
}

/**
 * Manage a number of features.
 */
export interface FeatureManager {

    /**
     * All the features we are managing
     */
    readonly features: ManagedFeature[];

    /**
     * Find the feature that manages fingerprints of this type
     */
    featureFor(type: string): ManagedFeature | undefined;

    /**
     * Report on the feature usage identified in this cohort of projects.
     * @param {HasFingerprints[]} results
     * @return {Promise<FingerprintCensus>}
     */
    fingerprintCensus(results: HasFingerprints[]): Promise<FingerprintCensus>;

    /**
     * Function that can resolve ideal status for this feature
     */
    idealResolver: IdealStore;

    /**
     * Is this fingerprint flagged as bad?
     * Return the empty array if no undesirableUsageChecker are found
     */
    undesirableUsageChecker: UndesirableUsageChecker;

    findUndesirableUsages(hf: HasFingerprints): Promise<UndesirableUsage[]>;

}

/**
 * UndesirableUsageChecker from a list
 * @param {(fp: FP) => Promise<Flag[]>} checkers
 * @return {UndesirableUsageChecker}
 */
export function chainUndesirableUsageCheckers(...checkers: UndesirableUsageChecker[]): UndesirableUsageChecker {
    return async fp => {
        for (const f of checkers) {
            const flagged = await f(fp);
            if (flagged) {
                return flagged;
            }
        }
        return [];
    };
}
