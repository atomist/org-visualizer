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
} from "@atomist/sdm-pack-analysis";
import { ManagedFeature } from "@atomist/sdm-pack-analysis/lib/analysis/TechnologyScanner";
import { FP } from "@atomist/sdm-pack-fingerprints";

/**
 * Features must have unique names
 */
export interface FeatureManager {

    features: Array<ManagedFeature<any>>;

    featuresWithIdeals(): Promise<Array<ManagedFeature<any> & { ideal?: FP }>>;

    /**
     * Find all the Features we can manage in this project
     * @return {Promise<Array<Huckleberry<any>>>}
     */
    featuresFound(pa: ProjectAnalysis): Promise<Array<ManagedFeature<any>>>;

    /**
     * Which Huckleberries could grow in this project that are not already growing.
     * They may not all be present
     * @return {Promise<Array<Huckleberry<any>>>}
     */
    possibleFeaturesNotFound(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<any>>>;

    ideal(name: string): Promise<FP | undefined>;
}
