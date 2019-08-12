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

import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import { Aspect, BaseAspect, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { Omit } from "../../util/omit";

export interface GlobMatch {
    path: string;
    size: number;
}

export interface GlobAspectData {
    matches: GlobMatch[];
}

export const GlobType = "glob";

export function isGlobFingerprint(fp: FP): fp is FP<GlobAspectData> {
    const maybe = fp as FP<GlobAspectData>;
    return maybe.type === GlobType && maybe.data.matches !== undefined;
}

/**
 * Check for presence of a glob
 * undefined to return no fingerprint.
 * Always return something, but may have an empty path.
 */
export function globAspect(config: Omit<BaseAspect, "stats" | "apply"> &
    { glob: string }): Aspect<FP<GlobAspectData>> {
    return {
        name: `glob-${sha256(config.glob)}`,
        toDisplayableFingerprintName: name => `Glob pattern '${name}'`,
        toDisplayableFingerprint: fp => fp.data.matches
            .map(m => `${m.path}(${m.size})`)
            .join(),
        ...config,
        extract: async p => {
            const data = {
                matches: await gatherFromFiles(p, config.glob, async f => ({
                    path: f.path,
                    size: (await f.getContent()).length,
                })),
            };
            return {
                name: config.glob,
                type: GlobType,
                data,
                sha: sha256(JSON.stringify(data)),
            };
        },
    };
}
