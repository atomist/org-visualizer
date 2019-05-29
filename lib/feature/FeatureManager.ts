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

import {
    ConsolidatedFingerprints,
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

/**
 * Report on feature usage in a cohort of projects
 */
export interface FingerprintCensus {

    readonly projectsAnalyzed: number;

    /**
     * Array of features with data about fingerprints they manage
     */
    features: Array<{
        feature: ManagedFeature,
        fingerprints: AggregateFingerprintStatus[],
    }>;
}

/**
 * Implemented by ProjectAnalysis or any other structure
 * representing a repo exposing fingerprint data
 */
export interface HasFingerprints {
    fingerprints: ConsolidatedFingerprints;
}

export function isHasFingerprints(a: any): a is HasFingerprints {
    const maybe = a as HasFingerprints;
    return !!maybe.fingerprints;
}

export type AnalysisDerivedFeature<FPI extends FP = FP> = DerivedFeature<ProjectAnalysis, FPI>;

/**
 * Type of feature we can manage
 */
export type ManagedFeature<FPI extends FP = FP> = Feature<FPI> | AnalysisDerivedFeature<FPI>;

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
     * Names of the fingerprints found in this project for which we have features to manage them
     */
    managedFingerprintNames(results: HasFingerprints[]): string[];

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
     * Which Huckleberries could grow in this project that are not already growing.
     * They may not all be present
     */
    possibleFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]>;

    necessaryFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]>;
}
