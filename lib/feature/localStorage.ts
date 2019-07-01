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
import { PossibleIdeal } from "@atomist/sdm-pack-fingerprints";
import * as fs from "fs";
import { IdealStore } from "../customize/featureManager";

const stupidStorageFilename = "ideals.json";
export const Ideals: IdealStore = retrieveFromLocalStorage();

export function retrieveFromLocalStorage(): IdealStore {
    try {
        logger.info("Retrieving ideals from %s", stupidStorageFilename);
        const ideals = JSON.parse(fs.readFileSync(stupidStorageFilename).toString());
        logger.info("Found %d ideals", Object.getOwnPropertyNames(ideals).length);
        return ideals;
    } catch (err) {
        logger.info("Did not retrieve from " + stupidStorageFilename + ": " + err.message);
        return {};
    }
}

export async function saveToLocalStorage(value: IdealStore): Promise<void> {
    fs.writeFileSync(stupidStorageFilename, JSON.stringify(value, undefined, 2));
}

export async function setIdeal(fingerprintName: string, ideal: PossibleIdeal): Promise<void> {
    Ideals[fingerprintName] = ideal;
    await saveToLocalStorage(Ideals);
}
