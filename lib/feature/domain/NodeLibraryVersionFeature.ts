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
import {
    InferredFeature,
    ProjectAnalysis,
} from "@atomist/sdm-pack-analysis";
import { NodeStack } from "@atomist/sdm-pack-analysis-node";
import { RelevanceTest } from "@atomist/sdm-pack-analysis/lib/analysis/TechnologyScanner";

/**
 * Represents a version of a particular library
 */
export class NodeLibraryVersion extends AbstractFingerprint {

    constructor(public readonly libName: string, public readonly libVersion: string) {
        super(libName, libName, "1.0.0", libName + ":" + libVersion);
    }
}

export class NodeLibraryVersionFeature implements InferredFeature<NodeStack, NodeLibraryVersion> {

    //private readonly flags: Array<(n: NodeLibraryVersion) => WarningFlag>;

    public get apply() {
        return async (p, t) => {
            throw new Error(`Applying Node library version ${t.libVersion} not yet supported`);
        }
    };

    public consequence(analysis: ProjectAnalysis) {
        const ns = analysis.elements.node as NodeStack;
        if (!ns) {
            return undefined;
        }
        const found = ns.dependencies.find(dep => dep.artifact === this.name);
        return found ? new NodeLibraryVersion(this.name, found.version) : undefined;
    }

    get relevanceTest(): RelevanceTest {
        return pa => !!pa.elements.node;
    }

    public compare(h1: NodeLibraryVersion, h2: NodeLibraryVersion, by: string): number {
        return h1.libVersion > h2.libVersion ? 1 : -1;
    }

    // public flag(h: NodeLibraryVersion): WarningFlag {
    //     for (const flag of this.flags) {
    //         const f = flag(h);
    //         if (!!f) {
    //             return f;
    //         }
    //     }
    //     return undefined;
    // }

    public toDisplayableString(h: NodeLibraryVersion): string {
        return h.libName + ":" + h.libVersion;
    }

    // /**
    //  * Version is ideal or version
    //  * @param {NodeLibraryVersion | string} sample
    //  * @param {(n: NodeLibraryVersion) => WarningFlag} flags
    //  */
    constructor(public readonly name: string,
                public readonly necessityTest?: RelevanceTest) {
             //   ...flags: Array<(n: NodeLibraryVersion) => WarningFlag>) {
        //this.flags = flags;
    }

}

function isNodeLibraryVersion(a: any): a is NodeLibraryVersion {
    const maybe = a as NodeLibraryVersion;
    return !!maybe.libName && !!maybe.libVersion;
}

// /**
//  * Ban this library
//  * @param {string} name
//  * @return {NodeLibraryVersionFeature}
//  */
// export function bannedLibraryHuckleberry(name: string): Huckleberry<any> {
//     return new NodeLibraryVersionFeature(name);
// }