import { IdealStore } from "../customize/featureManager";
import { PossibleIdeal } from "@atomist/sdm-pack-fingerprints";
import { logger } from "@atomist/automation-client";
import * as fs from "fs";

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