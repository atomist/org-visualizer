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
import { isGitHubFingerprint } from "./githubAspect";

export function gitHubCares(opts: { minStars: number }): Tagger {
    return {
        name: `stars>${opts.minStars}`,
        description: `GitHub cares: > ${opts.minStars} stars`,
        test: async rts => {
            const found = rts.analysis.fingerprints
                .filter(isGitHubFingerprint)
                .find(fp => fp.name === "stars");
            return found && found.data.count > opts.minStars;
        },
    }
}