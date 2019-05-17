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
    AbstractFingerprint,
} from "@atomist/sdm";
import { InferredTechnologyFeature } from "@atomist/sdm-pack-analysis";
import { NodeStack } from "@atomist/sdm-pack-analysis-node";

export class TypeScriptVersion extends AbstractFingerprint {

    constructor(public readonly typeScriptVersion: string) {
        super("tsVersion", "tsv", "1.0.0");
    }

    get data(): string {
        return JSON.stringify(this.typeScriptVersion);
    }
}

export class TypeScriptVersionFeature implements InferredTechnologyFeature<NodeStack, TypeScriptVersion> {

    public readonly name = "tsVersion";

    get apply() {
        return async (p, tsi) => {
            throw new Error(`Applying TypeScript version ${tsi.typeScriptVersion} not yet supported`);
        }
    };

    public consequence(n: NodeStack) {
        console.log("Consequence of " + n);
        return !!n.typeScript ?
            new TypeScriptVersion(n.typeScript.version) :
            undefined;
    }

    public get relevanceTest() {
        return pa => !!pa.elements.node;
    }

    // public flag(h: TypeScriptVersion) {
    //     if (h.typeScriptVersion < "3") {
    //         return { severity: "warn" as any, category: "ts", detail: `Version ${h.typeScriptVersion} is old` };
    //     }
    //     return undefined;
    // }

    public toDisplayableString(h: TypeScriptVersion): string {
        return h.typeScriptVersion;
    }

}

//public compare(h1: TypeScriptVersion, h2: TypeScriptVersion, by: string): number {
//         return h1.typeScriptVersion > h2.typeScriptVersion ? 1 : -1;
//     }