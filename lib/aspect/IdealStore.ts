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

import { Ideal } from "@atomist/sdm-pack-fingerprints";

/**
 * Function that can return the desired ideal, if any, for a given fingerprint name.
 * While an Aspect can suggest multiple ideals in the suggestedIdeals method,
 * there can only be one ideal recommended at any time.
 */
export interface IdealStore {

    storeIdeal(workspaceId: string, ideal: Ideal): Promise<void>;

    /**
     * Set the ideal to the given fingerprint id
     * @param {string} workspaceId
     * @param {string} fingerprintId
     * @return {Promise<void>}
     */
    setIdeal(workspaceId: string, fingerprintId: string): Promise<void>;

    loadIdeal(workspaceId: string, type: string, name: string): Promise<Ideal | undefined>;

    /**
     * Load all ideals in this workspace
     * @param {string} workspaceId
     * @return {Promise<Ideal[]>}
     */
    loadIdeals(workspaceId: string): Promise<Ideal[]>;

}
