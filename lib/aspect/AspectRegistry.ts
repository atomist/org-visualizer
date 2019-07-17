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
    Aspect,
    AtomicAspect,
    FP,
    Ideal,
} from "@atomist/sdm-pack-fingerprints";

/**
 * Function that can return the desired ideal, if any, for a given fingerprint name.
 * While an Aspect can suggest multiple ideals in the suggestedIdeals method,
 * there can only be one ideal recommended at any time.
 */
export interface IdealStore {

    storeIdeal(workspaceId: string, ideal: Ideal): Promise<void>;

    /**
     * Set the ideal to the given fingerprint id
     * @param {string} workspaceId
     * @param {string} fingerprintId
     * @return {Promise<void>}
     */
    setIdeal(workspaceId: string, fingerprintId: string): Promise<void>;

    loadIdeal(workspaceId: string, type: string, name: string): Promise<Ideal | undefined>;

    /**
     * Load all ideals in this workspace
     * @param {string} workspaceId
     * @return {Promise<Ideal[]>}
     */
    loadIdeals(workspaceId: string): Promise<Ideal[]>;
}

export type UndesirableUsageCheck = (workspaceId: string, fp: FP) => Promise<UndesirableUsage>;

/**
 * Function that can flag an issue with a fingerprint
 */
export interface UndesirableUsageChecker {
    check: UndesirableUsageCheck;
}

export const PermitAllUsageChecker: UndesirableUsageChecker = {
    check: async () => undefined,
};

export interface FingerprintsWithManagingAspect<ProcessedFingerprint> {
    aspect: ManagedAspect;
    fingerprints: ProcessedFingerprint[];
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
 * Type of Aspect we can manage
 */
export type ManagedAspect<FPI extends FP = FP> = Aspect<FPI> | AtomicAspect<FPI>;

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
 * Manage a number of aspects.
 */
export interface AspectRegistry {

    /**
     * All the aspects we are managing
     */
    readonly aspects: ManagedAspect[];

    /**
     * Find the aspect that manages fingerprints of this type
     */
    aspectOf(type: string): ManagedAspect | undefined;

    /**
     * Function that can resolve ideal status for this aspect
     */
    readonly idealStore: IdealStore;

    /**
     * Is this fingerprint flagged as bad?
     * Return the empty array if no undesirableUsageChecker are found
     */
    undesirableUsageChecker: UndesirableUsageChecker;

    findUndesirableUsages(workspaceId: string, hf: HasFingerprints): Promise<UndesirableUsage[]>;

}

/**
 * UndesirableUsageChecker from a list
 * @param {(fp: FP) => Promise<Flag[]>} checkers
 * @return {UndesirableUsageChecker}
 */
export function chainUndesirableUsageCheckers(...checkers: UndesirableUsageCheck[]): UndesirableUsageChecker {
    return {
        check: async (workspaceId, fp) => {
            for (const f of checkers) {
                const flagged = await f(workspaceId, fp);
                if (flagged) {
                    return flagged;
                }
            }
            return undefined;
        },
    };
}
