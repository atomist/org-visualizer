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

import { Huckleberry } from "./Huckleberry";
import { ProjectAnalysis, } from "@atomist/sdm-pack-analysis";
import { ManagedFeature } from "@atomist/sdm-pack-analysis/lib/analysis/TechnologyScanner";

export class HuckleberryManager {

    public readonly huckleberries: ManagedFeature<any>[];

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
     * Find all the Huckleberries we can manage in this project
     * @return {Promise<Array<Huckleberry<any>>>}
     */
    public async extract(pa: ProjectAnalysis): Promise<Array<ManagedFeature<any>>> {
        return this.huckleberries
            .filter(huck => !!pa.fingerprints[huck.name]);
    }

    /**
     * Which Huckleberries could grow in this project that are not already growing.
     * They may not all be present
     * @return {Promise<Array<Huckleberry<any>>>}
     */
    public async growable(analysis: ProjectAnalysis): Promise<Array<ManagedFeature<any>>> {
        // const present = await this.extract(analysis);
        // const canGrow = await Promise.all(this.huckleberries
        //      .map(h => h.canGrowHere(analysis)));
        // return this.huckleberries.filter((h, i) => !present[i] && canGrow[i])
        return [];
    }

    constructor(...huckleberries: ManagedFeature<any>[]) {
        this.huckleberries = huckleberries;
    }
}