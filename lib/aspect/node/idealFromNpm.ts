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

import { logger } from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import { ConcreteIdeal } from "@atomist/sdm-pack-fingerprint";
import {
    createNpmDepFingerprint,
    deconstructNpmDepsFingerprintName,
} from "@atomist/sdm-pack-fingerprint/lib/fingerprints/npmDeps";

export async function idealsFromNpm(name: string): Promise<ConcreteIdeal[]> {
    const ideal = await idealFromNpm(name);
    return ideal ? [ideal] : [];
}

export async function idealFromNpm(name: string): Promise<ConcreteIdeal> {
    const libraryName = deconstructNpmDepsFingerprintName(name);
    try {
        const result = await execPromise("npm", ["view", libraryName, "dist-tags.latest"]);
        logger.info(`World Ideal Version is ${result.stdout} for ${libraryName}`);
        return {
            ideal: createNpmDepFingerprint(libraryName, result.stdout.trim()),
            reason: "latest from NPM",
        };
    } catch (err) {
        logger.error("Could not find version of " + libraryName + ": " + err.message);
    }
    return undefined;
}
