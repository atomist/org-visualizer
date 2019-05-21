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
    FeatureManager,
    IdealResolver,
    IdealStatus,
    ManagedFingerprint,
    ManagedFingerprints,
} from "./FeatureManager";

import { FP } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

export function allFingerprints(ar: ProjectAnalysisResult | ProjectAnalysisResult[]): FP[] {
    const results: ProjectAnalysisResult[] = Array.isArray(ar) ? ar : [ar] as any;
    return _.flatMap(results, ar => Object.getOwnPropertyNames(ar.analysis.fingerprints)
        .map(name => ar.analysis.fingerprints[name]));
}

/**
 * Features must have unique names
 */
export class DefaultFeatureManager implements FeatureManager {

    public readonly features: Array<ManagedFeature<TechnologyElement>>;

    public featureFor(fp: FP): ManagedFeature<TechnologyElement> | undefined {
        return !!fp ? this.features.find(f => f.selector(fp)) : undefined;
    }

    public managedFingerprintNames(results: ProjectAnalysisResult[]): string[] {
        const fingerprints: FP[] = _.flatMap(results, allFingerprints);
        const relevantFingerprints = fingerprints.filter(fp => this.features.some(feature => feature.selector(fp)));
        return _.uniq(relevantFingerprints.map(fp => fp.name));
    }

    public async managedFingerprints(repos: ProjectAnalysisResult[]): Promise<ManagedFingerprints> {
        const result: ManagedFingerprints = {
            projectsAnalyzed: repos.length,
            features: [],
        };
        const allFingerprintsInAllProjects: FP[] = _.flatMap(repos, allFingerprints);
        for (const feature of this.features) {
            const names = _.uniq(allFingerprintsInAllProjects.filter(fp => feature.selector(fp)).map(fp => fp.name));
            const fingerprints: ManagedFingerprint[] = [];
            for (const name of names) {
                fingerprints.push({
                    name,
                    appearsIn: allFingerprintsInAllProjects.filter(fp => fp.name === name).length,
                    variants: _.uniq(allFingerprintsInAllProjects.filter(fp => fp.name === name).map(fp => fp.sha)).length,
                    ideal: await this.idealResolver(name),
                    featureName: feature.displayName,
                });
            }
            result.features.push({
                feature,
                fingerprints: fingerprints
                    .sort((a, b) => b.appearsIn - a.appearsIn)
                    .sort((a, b) => b.variants - a.variants),
            });
        }
        return result;
    }

    public async projectFingerprints(par: ProjectAnalysisResult): Promise<Array<{
        feature: ManagedFeature<TechnologyElement>,
        fingerprints: Array<FP & { ideal?: IdealStatus, stringified: string, displayName: string }>,
    }>> {
        const result = [];
        const allFingerprintsInOneProject: FP[] = allFingerprints(par);
        for (const feature of this.features) {
            const originalFingerprints = allFingerprintsInOneProject.filter(fp => feature.selector(fp));
            if (originalFingerprints.length > 0) {
                const toDisplayableFingerprintName = feature.toDisplayableFingerprintName || (ffff => ffff);
                const toDisplayableFingerprint = feature.toDisplayableFingerprint || (ffff => ffff.data);
                const fingerprints = _.cloneDeep(originalFingerprints);
                for (const fp of fingerprints) {
                    (fp as any).ideal = await this.idealResolver(fp.name);
                    (fp as any).stringified = toDisplayableFingerprint(fp);
                    (fp as any).displayName = toDisplayableFingerprintName(fp.name);
                }
                result.push({
                    feature,
                    fingerprints,
                });
            }
        }
        return result;
    }
    // /**
    //  * Commands to transform
    //  * @return {Array<CodeTransformRegistration<{name: string}>>}
    //  */
    // get commands(): Array<CodeTransformRegistration<{ name: string }>> {
    //     // Commands
    //     return this.huckleberries
    //         .map(huck => {
    //             return {
    //                 name: `add-hucklerry-${huck.name}`,
    //                 intent: `add huckleberry ${huck.name}`,
    //                 transform: huck.makeItSo(huck.ideal, undefined),
    //             }
    //         });
    //     // TODO huck extractor command
    // }
    //
    // get autofixes(): AutofixRegistration[] {
    //     return this.huckleberries
    //         .filter(huck => !!huck.ideal && !!huck.makeItSo)
    //         .map(huck => {
    //             return {
    //                 name: `${huck.name}-autofix`,
    //                 // TODO this is wrong because it may not exist
    //                 transform: huck.makeItSo(huck.ideal, undefined),
    //             }
    //         });
    // }

    /**
     * Find all the Features we can manage in this project
     */
    public async featuresFound(pa: ProjectAnalysis): Promise<Array<ManagedFeature<TechnologyElement>>> {
        return _.uniq(
            _.flatMap(Object.getOwnPropertyNames(pa.fingerprints)
                .map(name => this.features.filter(f => f.selector(pa.fingerprints[name]))),
            ));
    }

    /**
     * Which features could grow in this project that are not already growing.
     * They may not all be present
     */
    public async possibleFeaturesNotFound(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<TechnologyElement>>> {
        // const present = await this.featuresFound(analysis);
        // const canGrow = await Promise.all(this.features
        //     .map(h => (h.relevanceTest || (() => false))(analysis)));
        // return this.features.filter((h, i) => !present[i] && canGrow[i])
        return [];
    }

    public async necessaryFeaturesNotFound(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<TechnologyElement>>> {
        // const present = await this.featuresFound(analysis);
        // const shouldGrow = await Promise.all(this.features
        //     .map(h => (h.necessityTest || (() => false))(analysis)));
        // return this.features.filter((h, i) => !present[i] && shouldGrow[i])
        return [];
    }

    constructor(
        public readonly idealResolver: IdealResolver,
        ...features: Array<ManagedFeature<TechnologyElement>>
    ) {
        this.features = features;
    }
}
