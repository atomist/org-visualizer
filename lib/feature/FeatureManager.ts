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
    ProjectAnalysis,
    TechnologyElement,
} from "@atomist/sdm-pack-analysis";
import {
    DerivedFeature,
    Feature,
    FP,
    PossibleIdeal,
} from "@atomist/sdm-pack-fingerprints";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

import * as _ from "lodash";
import { ConsolidatedFingerprints } from "@atomist/sdm-pack-analysis/lib/analysis/ProjectAnalysis";


export type IdealResolver = (name: string) => Promise<PossibleIdeal<FP>>;

export interface ManagedFingerprint {

    featureName: string;

    name: string;

    /**
     * Number of projects this fingerprint appears in
     */
    appearsIn: number;

    ideal: PossibleIdeal;

    /**
     * Number of variants
     */
    variants: number;
}

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

export interface HasFingerprints {
    fingerprints: ConsolidatedFingerprints;
}

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

export type AnalysisDerivedFeature<FPI extends FP = FP> = DerivedFeature<ProjectAnalysis, FPI>;

export type ManagedFeature<FPI extends FP = FP> = Feature<FPI> | AnalysisDerivedFeature<FPI>;

/**
 * Features must have unique names
 */
export interface FeatureManager {

    readonly features: ManagedFeature[];

    /**
     * Find the feature that manages this fingerprint
     * @param {FP} fp
     * @return {ManagedFeature<TechnologyElement> | undefined}
     */
    featureFor(fp: FP): ManagedFeature | undefined;

    // TODO take hasFingerprints
    managedFingerprintNames(results: ProjectAnalysisResult[]): string[];

    managedFingerprints(results: ProjectAnalysisResult[]): Promise<ManagedFingerprints>;

    /**
     * Find all the Features we can manage in this project
     */
    featuresFound(pa: ProjectAnalysis): Promise<ManagedFeature[]>;

    /**
     * Which Huckleberries could grow in this project that are not already growing.
     * They may not all be present
     */
    possibleFeaturesNotFound(analysis: ProjectAnalysis): Promise<ManagedFeature[]>;

    necessaryFeaturesNotFound(analysis: ProjectAnalysis): Promise<ManagedFeature[]>;

    /**
     * Function that can resolve status for this feature
     * @param {string} name
     * @return {Promise<FP | "exterminate" | undefined>}
     */
    idealResolver: IdealResolver;
}
