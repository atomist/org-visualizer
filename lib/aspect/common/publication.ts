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

import { PublishFingerprints } from "@atomist/sdm-pack-fingerprint";
import { ProjectAnalysisResultStore } from "@atomist/sdm-pack-aspect/lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { sendFingerprintsToAtomist } from "@atomist/sdm-pack-fingerprint/lib/adhoc/fingerprints";
import { storeFingerprints } from "@atomist/sdm-pack-aspect/lib/aspect/delivery/storeFingerprintsPublisher";

/**
 * Store
 * @param {ProjectAnalysisResultStore} store
 * @return {PublishFingerprints}
 */
export function sendFingerprintsEverywhere(store: ProjectAnalysisResultStore): PublishFingerprints {
    const here = storeFingerprints(store);
    const there = sendFingerprintsToAtomist;
    return async (i, fps, previous)=> {
        await here(i, fps, previous);
        return there(i, fps, previous);
    };
}