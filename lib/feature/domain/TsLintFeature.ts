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

import { AbstractFingerprint, } from "@atomist/sdm";
import { Feature } from "@atomist/sdm-pack-fingerprints";

import * as _ from "lodash";

export class TsLintProperty extends AbstractFingerprint {

    constructor(public readonly path: string, public readonly property: string, data: any) {
        super(`tslintproperty::${path}:${property}`, "tsp", "1.0.0", JSON.stringify(data));
    }

}

export class TsLintPropertyFeature implements Feature<TsLintProperty> {

    public displayName = "TsLint";

    public readonly name = "tsVersion";

    get apply() {
        return async (p, tsi) => {
            throw new Error(`Applying tslint version ${tsi.typeScriptVersion} not yet supported`);
        };
    }

    public selector = fp => fp.name.startsWith("tslintproperty::");

    public extract = async p => {
        const tslint = await p.getFile("tslint.json");
        if (!tslint) {
            return undefined;
        }
        const content = await tslint.getContent();
        const json = JSON.parse(content);
        const pathObj = _.get(json, this.path, {});
        return Object.getOwnPropertyNames(pathObj)
            .map(property => {
                console.log(`property=${property} in PathObj` + JSON.stringify(pathObj) );
                return new TsLintProperty(
                    this.path,
                    property,
                    pathObj[property] || "");
            });
    };

    //toDisplayableFingerprintName

    // public async suggestIdeal(fingerprintName: string, cohort: TypeScriptVersion[]): Promise<PossibleIdeals<TypeScriptVersion>> {
    //     return {
    //         world: {
    //             reason: "hard-coded",
    //             url: "http://jessitron.com",
    //             ideal: new TypeScriptVersion("3.4.57"),
    //         },
    //         fromProjects: {
    //             reason: "hard-coded also",
    //             url: "http://jessitron.com",
    //             ideal: new TypeScriptVersion("3.4.79"),
    //         },
    //     };
    // }

    constructor(public readonly path = "rules") {
    }

}

// public compare(h1: TypeScriptVersion, h2: TypeScriptVersion, by: string): number {
//         return h1.typeScriptVersion > h2.typeScriptVersion ? 1 : -1;
//     }
