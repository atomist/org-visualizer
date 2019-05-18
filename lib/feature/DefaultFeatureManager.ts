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

import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { ManagedFeature } from "@atomist/sdm-pack-analysis/lib/analysis/TechnologyScanner";
import { FeatureManager, IdealResolver, IdealStatus, } from "./FeatureManager";

/**
 * Features must have unique names
 */
export class DefaultFeatureManager implements FeatureManager {

    public readonly features: ManagedFeature<any>[];

    public async featuresWithIdeals() {
        const results: Array<ManagedFeature<any> & { ideal: IdealStatus }> = [];
        for (const feature of this.features) {
            results.push({
                ...feature,
                ideal: await this.idealResolver(feature.name),
            })
        }
        return results;
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
    public async featuresFound(pa: ProjectAnalysis): Promise<Array<ManagedFeature<any>>> {
        return this.features
            .filter(huck => !!pa.fingerprints[huck.name]);
    }

    /**
     * Which features could grow in this project that are not already growing.
     * They may not all be present
     */
    public async possibleFeaturesNotFound(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<any>>> {
        const present = await this.featuresFound(analysis);
        const canGrow = await Promise.all(this.features
            .map(h => (h.relevanceTest || (() => false))(analysis)));
        return this.features.filter((h, i) => !present[i] && canGrow[i])
    }

    public async necessaryFeaturesNotFound(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<any>>> {
        const present = await this.featuresFound(analysis);
        const shouldGrow = await Promise.all(this.features
            .map(h => (h.necessityTest || (() => false))(analysis)));
        return this.features.filter((h, i) => !present[i] && shouldGrow[i])
    }

    constructor(public readonly idealResolver: IdealResolver,
                ...features: ManagedFeature<any>[]
    ) {
        this.features = features;
    }
}