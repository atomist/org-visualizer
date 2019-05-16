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

import { Huckleberry, WarningFlag } from "./Huckleberry";
import {
    AbstractFingerprint,
    CodeTransform,
} from "@atomist/sdm";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";

/**
 * Represents a version of a particular library
 */
export class NodeLibraryVersion extends AbstractFingerprint {

    constructor(public readonly libName: string, public readonly libVersion: string) {
        super(libName, libName, "1.0.0");
    }

    get data(): string {
        return JSON.stringify(this.libName + ":" + this.libVersion);
    }
}

export class NodeLibraryVersionHuckleberry implements Huckleberry<NodeLibraryVersion> {

    private readonly flags: Array<(n: NodeLibraryVersion) => WarningFlag>;

    public makeItSo(t: NodeLibraryVersion): CodeTransform {
        return async p => {
            throw new Error("Applying Node library version not yet supported");
        }
    };

    get name() {
        return isNodeLibraryVersion(this.sample) ? this.sample.libName : this.sample;
    }

    public async canGrowHere(pa: ProjectAnalysis): Promise<boolean> {
        return !!pa.elements.node;
    }

    public compare(h1: NodeLibraryVersion, h2: NodeLibraryVersion, by: string): number {
        return h1.libVersion > h2.libVersion ? 1 : -1;
    }

    public flag(h: NodeLibraryVersion): WarningFlag {
        for (const flag of this.flags) {
            const f = flag(h);
            if (!!f) {
                return f;
            }
        }
        return undefined;
    }

    public toReadableString(h: NodeLibraryVersion): string {
        return h.libName + ":" + h.libVersion;
    }

    get ideal(): NodeLibraryVersion {
        return isNodeLibraryVersion(this.sample) ? this.sample : undefined;
    }

    /**
     * Version is ideal or version
     * @param {NodeLibraryVersion | string} sample
     * @param {(n: NodeLibraryVersion) => WarningFlag} flags
     */
    constructor(private readonly sample: NodeLibraryVersion | string,
                ...flags: Array<(n: NodeLibraryVersion) => WarningFlag>) {
        this.flags = flags;
    }

}

function isNodeLibraryVersion(a: any): a is NodeLibraryVersion {
    const maybe = a as NodeLibraryVersion;
    return !!maybe.libName && !!maybe.libVersion;
}

/**
 * Ban this library
 * @param {string} name
 * @return {NodeLibraryVersionHuckleberry}
 */
export function bannedLibraryHuckleberry(name: string): Huckleberry<any> {
    return new NodeLibraryVersionHuckleberry(name);
}