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

import { RepositoryScorer } from "@atomist/sdm-pack-aspect";
import { NpmDeps } from "@atomist/sdm-pack-fingerprints";
import { TypeScriptVersionType } from "../aspect/node/TypeScriptVersion";

/**
 * TypeScript projects must use tslint
 * @param {TaggedRepo} repo
 * @return {Promise<any>}
 * @constructor
 */
export const TypeScriptProjectsMustUseTsLint: RepositoryScorer = async repo => {
    const isTs = repo.analysis.fingerprints.some(fp => fp.type === TypeScriptVersionType);
    if (!isTs) {
        return undefined;
    }
    const hasTsLint = repo.analysis.fingerprints.some(fp => fp.type === NpmDeps.name && fp.data[0] === "tslint");
    return {
        name: "has-tslint",
        score: hasTsLint ? 5 : 1,
        reason: hasTsLint ? "TypeScript projects should use tslint" : "TypeScript project using tslint",
    };
};
