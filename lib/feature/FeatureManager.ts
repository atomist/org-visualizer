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
    ProjectAnalysis,
} from "@atomist/sdm-pack-analysis/lib/analysis/ProjectAnalysis";
import {
    DerivedFeature,
    Feature,
    FP,
    PossibleIdeal,
} from "@atomist/sdm-pack-fingerprints";

/**
 * Function that can return the desired ideal, if any, for a given fingerprint name
 */
export type IdealResolver = (fingerprintName: string) => Promise<PossibleIdeal<FP>>;

/**
 * Function that can flag an issue with a fingerprint
 */
export type Flagger = (fp: FP) => Promise<Flag[]>;

/**
 * Report on use of a fingerprint across a cohort of projects
 */
export interface AggregateFingerprintStatus {

    /**
     * Feature that owns this fingerprint
     */
    readonly featureName: string;

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

export type AnalysisDerivedFeature<FPI extends FP = FP> = DerivedFeature<ProjectAnalysis, FPI>;

/**
 * Type of feature we can manage
 */
export type ManagedFeature<FPI extends FP = FP> = Feature<FPI> | AnalysisDerivedFeature<FPI>;

// TODO: Hey Rod, can we call this UndesirableUsage instead? "flag" could mean a zillion things. Flag is a verb here.
/**
 * Flag for an undesirable usage
 */
export interface Flag {

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
     * For example, a security advice.
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
     * Find the feature that manages this fingerprint
     */
    featureFor(fp: FP): ManagedFeature | undefined;

    /**
     * Find all the Features relevant to this project:
     * That is, which can manage fingerprints found in this project
     */
    featuresFound(hf: HasFingerprints): Promise<ManagedFeature[]>;

    /**
     * Report on the feature usage identified in this cohort of projects.
     * @param {HasFingerprints[]} results
     * @return {Promise<FingerprintCensus>}
     */
    fingerprintCensus(results: HasFingerprints[]): Promise<FingerprintCensus>;

    /**
     * Function that can resolve ideal status for this feature
     */
    idealResolver: IdealResolver;

    /**
     * Is this fingerprint flagged as bad?
     * Return the empty array if no flags are found
     * @param {FP} fp
     * @return {Promise<Flag>}
     */
    flags: Flagger;

    /**
     * Which Huckleberries could grow in this project that are not already growing.
     * They may not all be present
     */
    possibleFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]>;

    necessaryFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]>;
}

/**
 * Flagger from a list
 * @param {(fp: FP) => Promise<Flag[]>} flaggings
 * @return {Flagger}
 */
export function simpleFlagger(...flaggings: Array<(fp: FP) => Promise<Flag>>): Flagger {
    return async fp => {
        for (const f of flaggings) {
            const flagged = await f(fp);
            if (flagged) {
                return [flagged];
            }
        }
        return [];
    };
}
