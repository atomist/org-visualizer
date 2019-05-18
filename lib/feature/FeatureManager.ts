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
    ManagedFeature,
    ProjectAnalysis,
    TechnologyElement,
} from "@atomist/sdm-pack-analysis";
import {
    Feature,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { ManagedFingerprint } from "./FeatureManager";

/**
 * Constant meaning to eliminate a feature
 * @type {string}
 */
export type Eliminate = "eliminate";

export type IdealStatus = FP | undefined | Eliminate;

/**
 * Constant version of eliminate
 * @type {"eliminate"}
 */
export const Eliminate: Eliminate = "eliminate";

export function isDistinctIdeal(idealStatus: IdealStatus): idealStatus is FP {
    if (!idealStatus) {
        return false;
    }
    const maybe = idealStatus as FP;
    return !!maybe.abbreviation;
}

export type IdealResolver = (name: string) => Promise<IdealStatus>;

export interface ManagedFingerprint {
    name: string;

    /**
     * Number of projects this fingerprint appears in
     */
    appearsIn: number;
    ideal: IdealStatus;
}

export interface ManagedFingerprints {
    features: Array<{
        feature: ManagedFeature<TechnologyElement>,
        fingerprints: ManagedFingerprint[],
    }>;
}

/**
 * Features must have unique names
 */
export interface FeatureManager {

    readonly features: Array<ManagedFeature<TechnologyElement>>;

    /**
     * Find the feature that manages this fingerprint
     * @param {FP} fp
     * @return {ManagedFeature<TechnologyElement> | undefined}
     */
    featureFor(fp: FP): ManagedFeature<TechnologyElement> | undefined;

    managedFingerprintNames(results: ProjectAnalysisResult[]): string[];

    managedFingerprints(results: ProjectAnalysisResult[]): Promise<ManagedFingerprints>;

    /**
     * Find all the Features we can manage in this project
     */
    featuresFound(pa: ProjectAnalysis): Promise<Array<ManagedFeature<TechnologyElement>>>;

    /**
     * Which Huckleberries could grow in this project that are not already growing.
     * They may not all be present
     */
    possibleFeaturesNotFound(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<TechnologyElement>>>;

    necessaryFeaturesNotFound(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<TechnologyElement>>>;

    /**
     * Function that can resolve status for this feature
     * @param {string} name
     * @return {Promise<FP | "exterminate" | undefined>}
     */
    idealResolver: IdealResolver;
}
