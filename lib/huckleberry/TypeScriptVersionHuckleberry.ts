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
import { AbstractFingerprint, CodeTransform } from "@atomist/sdm";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";

export class TypeScriptVersion extends AbstractFingerprint {

    constructor(public readonly typeScriptVersion: string) {
        super("tsVersion", "tsv", "1.0.0");
    }

    get data(): string {
        return JSON.stringify(this.typeScriptVersion);
    }
}

export class TypeScriptVersionHuckleberry implements Huckleberry<TypeScriptVersion> {

    public makeItSo(t: TypeScriptVersion): CodeTransform {
        return async p => {
            throw new Error("Applying TypeScript version not yet supported");
        }
    };

    public readonly name = "tsVersion";

    public async canGrowHere(pa: ProjectAnalysis): Promise<boolean> {
        return !!pa.elements.node;
    }

    public compare(h1: TypeScriptVersion, h2: TypeScriptVersion, by: string): number {
        return h1.typeScriptVersion > h2.typeScriptVersion ? 1 : -1;
    }

    public flag(h: TypeScriptVersion) {
        if (h.typeScriptVersion < "3") {
            return { severity: "warn" as any, category: "ts", detail: `Version ${h.typeScriptVersion} is old` };
        }
        return undefined;
    }

    public toReadableString(h: TypeScriptVersion): string {
        return h.typeScriptVersion;
    }

    constructor(public readonly ideal = new TypeScriptVersion("3.4.5")) {
    }

}