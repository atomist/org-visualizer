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

import { AbstractFingerprint } from "@atomist/sdm";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { NodeStack } from "@atomist/sdm-pack-analysis-node";
import { PossibleIdeal } from "@atomist/sdm-pack-fingerprints";
import { AnalysisDerivedFeature } from "../FeatureManager";

export class TypeScriptVersion extends AbstractFingerprint {

    public type = "language";

    constructor(public readonly typeScriptVersion: string) {
        super("tsVersion", "tsv", "1.0.0", typeScriptVersion);
    }

}

export class TypeScriptVersionFeature implements AnalysisDerivedFeature<TypeScriptVersion> {

    public displayName = "TypeScript version";

    public readonly name = "tsVersion";

    get apply() {
        return async (p, tsi) => {
            throw new Error(`Applying TypeScript version ${tsi.typeScriptVersion} not yet supported`);
        };
    }

    public selector = fp => fp.name === "tsVersion";

    public async derive(analysis: ProjectAnalysis) {
        const n = analysis.elements.node as NodeStack;
        if (!n) {
            return undefined;
        }
        return !!n.typeScript && n.typeScript.hasDependency ?
            new TypeScriptVersion(n.typeScript.version) :
            undefined;
    }

    public toDisplayableFingerprint(fpi: TypeScriptVersion): string {
        return fpi.data;
    }

    public toDisplayableFingerprintName(fingerprintName: string) {
        return "TypeScript version";
    }

    public async suggestedIdeals(fingerprintName: string): Promise<Array<PossibleIdeal<TypeScriptVersion>>> {
        const ideal = new TypeScriptVersion("3.4.57");
        return [{
            fingerprintName,
            reason: "hard-coded",
            url: "http://jessitron.com",
            ideal,
        }];
    }

}

// public compare(h1: TypeScriptVersion, h2: TypeScriptVersion, by: string): number {
//         return h1.typeScriptVersion > h2.typeScriptVersion ? 1 : -1;
//     }
