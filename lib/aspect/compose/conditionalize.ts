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
    logger,
    Project,
} from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import { Aspect } from "@atomist/sdm-pack-fingerprints";

// TODO move to fingerprints pack

/**
 * Make this aspect conditional
 */
export function conditionalize(aspect: Aspect,
                               test: (p: Project) => Promise<boolean>,
                               details: Partial<Pick<Aspect, "name" | "displayName" |
                                   "toDisplayableFingerprint" | "toDisplayableFingerprintName">> = {}): Aspect {
    return {
        ...aspect,
        name: details.name || aspect.name,
        displayName: details.displayName || aspect.displayName,
        toDisplayableFingerprintName: details.toDisplayableFingerprintName || aspect.toDisplayableFingerprintName,
        toDisplayableFingerprint: details.toDisplayableFingerprint || aspect.toDisplayableFingerprint,
        extract: async p => {
            const testResult = await test(p);
            if (testResult) {
                const rawFingerprints = toArray(await aspect.extract(p));
                return rawFingerprints.map(raw => {
                    const merged = {
                        ...raw,
                        ...details,
                    };
                    logger.debug("Merged fingerprints=%j", merged);
                    return merged;
                });
            }
            return undefined;
        },
    };
}
