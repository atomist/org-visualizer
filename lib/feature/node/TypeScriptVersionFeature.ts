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

import { AtomicFeature, FP, NpmDeps, PossibleIdeal, sha256 } from "@atomist/sdm-pack-fingerprints";

export type TypeScriptVersionName = "tsVersion";
export const TypeScriptVersionName = "tsVersion";

export interface TypeScriptVersion extends FP {

    name: TypeScriptVersionName;
    data: string;

}

export class TypeScriptVersionFeature implements AtomicFeature<TypeScriptVersion> {

    public readonly displayName = "TypeScript version";

    public readonly name = TypeScriptVersionName;

    get apply() {
        return async (p, tsi) => {
            throw new Error(`Applying TypeScript version ${tsi.typeScriptVersion} not yet supported`);
        };
    }

    public selector = fp => fp.name === TypeScriptVersionName;

    public async consolidate(fps: FP[]): Promise<TypeScriptVersion> {
        const target = fps
            .filter(fp => fp.type === NpmDeps.name)
            .find(fp => fp.name === "typescript");
        return !!target ? {
            name: TypeScriptVersionName,
            type: "TypeScript",
            data: target.data[1],
            sha: sha256(target.data[1]),
        } : undefined;
    }

    public toDisplayableFingerprintName(): string {
        return "TypeScript version";
    }

    public toDisplayableFingerprint(fpi: TypeScriptVersion): string {
        return fpi.data;
    }

    // public async suggestedIdeals(fingerprintName: string): Promise<Array<PossibleIdeal<TypeScriptVersion>>> {
    //     const ideal = new TypeScriptVersion("3.4.57");
    //     return [{
    //         fingerprintName,
    //         reason: "hard-coded",
    //         url: "http://jessitron.com",
    //         ideal,
    //     }];
    // }

}

// public compare(h1: TypeScriptVersion, h2: TypeScriptVersion, by: string): number {
//         return h1.typeScriptVersion > h2.typeScriptVersion ? 1 : -1;
//     }
