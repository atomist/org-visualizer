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

import { Tagger } from "@atomist/sdm-pack-aspect";
import { NpmDeps } from "@atomist/sdm-pack-fingerprint";
import { TsLintType } from "../aspect/node/TsLint";
import { TypeScriptVersion } from "../aspect/node/TypeScriptVersion";

export const Node: Tagger = {
    name: "node",
    description: "Node",
    test: async repo => repo.analysis.fingerprints.some(fp => fp.type === NpmDeps.name),
};

export const TypeScript: Tagger = {
    name: "typescript",
    description: "TypeScript version",
    test: async repo => repo.analysis.fingerprints.some(fp => fp.type === TypeScriptVersion.name),
};

export const TsLint = {
    name: "tslint",
    description: "tslint (TypeScript)",
    test: async repo => repo.analysis.fingerprints.some(fp => fp.type === TsLintType),
};

export function usesNodeLibrary(opts: {
    library: string,
    version?: string,
    name?: string,
}): Tagger {
    return usesNodeLibraryWhen({
        name: opts.name || opts.library,
        test: (lib, version) => lib === opts.library &&
            (opts.version ? version === opts.version : true),
        description: `Uses node library ${opts.library}`,
    });
}

export function usesNodeLibraryWhen(opts: {
    test: (lib: string, version: string) => boolean,
    name: string,
    description: string,
}): Tagger {
    return {
        name: opts.name,
        description: opts.description,
        test: async repo => repo.analysis.fingerprints.some(fp => fp.type === NpmDeps.name && opts.test(fp.data[0], fp.data[1])),
    };
}
