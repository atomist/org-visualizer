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

export type IdealResolver = (name: string) => Promise<PossibleIdeal<FP>>;

/**
 * Report on use of a fingerprint across of cohort of projects
 */
export interface ManagedFingerprint {

    /**
     * Feature that owns this fingerprint
     */
    featureName: string;

    /**
     * Fingerprint name
     */
    name: string;

    /**
     * Number of projects this fingerprint appears in
     */
    appearsIn: number;

    ideal: PossibleIdeal;

    /**
     * Number of variants of this fingerprint across the cohort
     */
    variants: number;
}

/**
 * Report on feature usage in a cohort of projects
 */
export interface ManagedFingerprints {

    projectsAnalyzed: number;

    /**
     * Array of features with data about fingerprints they manage
     */
    features: Array<{
        feature: ManagedFeature,
        fingerprints: ManagedFingerprint[],
    }>;
}

/**
 * Implemented by ProjectAnalysis or any other structure
 * representing a repo exposing fingerprint data
 */
export interface HasFingerprints {
    fingerprints: ConsolidatedFingerprints;
}

export type AnalysisDerivedFeature<FPI extends FP = FP> = DerivedFeature<ProjectAnalysis, FPI>;

/**
 * Type of feature we can manage
 */
export type ManagedFeature<FPI extends FP = FP> = Feature<FPI> | AnalysisDerivedFeature<FPI>;

/**
 * Features must have unique names
 */
export interface FeatureManager {

    /**
     * All the features we are manage
     */
    readonly features: ManagedFeature[];

    /**
     * Find the feature that manages this fingerprint
     */
    featureFor(fp: FP): ManagedFeature | undefined;

    managedFingerprintNames(results: HasFingerprints[]): string[];

    managedFingerprints(results: HasFingerprints[]): Promise<ManagedFingerprints>;

    /**
     * Find all the Features we can manage in this project
     */
    featuresFound(hf: HasFingerprints): Promise<ManagedFeature[]>;

    /**
     * Which Huckleberries could grow in this project that are not already growing.
     * They may not all be present
     */
    possibleFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]>;

    necessaryFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]>;

    /**
     * Function that can resolve ideal status for this feature
     */
    idealResolver: IdealResolver;
}
