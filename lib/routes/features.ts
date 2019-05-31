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
import {
    Scorer,
} from "@atomist/sdm-pack-analysis";
import {
    DockerFrom,
    FP,
    NpmDeps,
    PossibleIdeal,
} from "@atomist/sdm-pack-fingerprints";
import {
    deconstructNpmDepsFingerprintName,
    getNpmDepFingerprint,
} from "@atomist/sdm-pack-fingerprints/lib/fingerprints/npmDeps";
import * as fs from "fs";
import { DefaultFeatureManager } from "../feature/DefaultFeatureManager";
import { TsLintPropertyFeature } from "../feature/domain/TsLintFeature";
import {
    TypeScriptVersionFeature,
} from "../feature/domain/TypeScriptVersionFeature";
import {
    FeatureManager,
    ManagedFeature, simpleFlagger,
} from "../feature/FeatureManager";

export const features: ManagedFeature[] = [
    new TypeScriptVersionFeature(),
    DockerFrom,
    {
        ...NpmDeps,
        suggestedIdeals: idealFromNpm,
    },
    new TsLintPropertyFeature(),
];

async function idealFromNpm(fingerprintName: string): Promise<Array<PossibleIdeal<FP>>> {
    const libraryName = deconstructNpmDepsFingerprintName(fingerprintName);
    try {
        const result = await execPromise("npm", ["view", libraryName, "dist-tags.latest"]);
        logger.info(`World Ideal Version is ${result.stdout} for ${libraryName}`);
        return [{
            fingerprintName,
            ideal: getNpmDepFingerprint(libraryName, result.stdout.trim()),
            reason: "latest from NPM",
        }];
    } catch (err) {
        logger.error("Could not find version of " + libraryName + ": " + err.message);
    }

    return undefined;
}

export type IdealStore = Record<string, PossibleIdeal>;

const DefaultIdeals: IdealStore = {
    "npm-project-dep::axios": {
        fingerprintName: "npm-project-dep::axios",
        ideal: undefined,
        reason: "Proxying errors",
    },
    // "npm-project-dep::lodash": getNpmDepFingerprint("lodash", "^4.17.11"),
    // "npm-project-dep::atomist::sdm": getNpmDepFingerprint("@atomist/sdm", "1.5.0"),
    // "tsVersion": new TypeScriptVersion("^3.4.5"),
};

const stupidStorageFilename = "ideals.json";
const Ideals: IdealStore = retrieveFromStupidLocalStorage();

export function retrieveFromStupidLocalStorage(): IdealStore {
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

export function saveToStupidLocalStorage(value: IdealStore): void {
    fs.writeFileSync(stupidStorageFilename, JSON.stringify(value, undefined, 2));
}

export function setIdeal(fingerprintName: string, ideal: PossibleIdeal): void {
    Ideals[fingerprintName] = ideal;
    saveToStupidLocalStorage(Ideals);
}

export const featureManager = new DefaultFeatureManager({
        idealResolver: async name => {
            return Ideals[name];
        },
        features,
        flags: simpleFlagger(),
    }
);

export function idealConvergenceScorer(fm: FeatureManager): Scorer {
    return async i => {
        const allFingerprintNames = Object.getOwnPropertyNames(i.reason.analysis.fingerprints);
        let correctFingerprints = 0;
        let hasIdeal = 0;
        for (const name of allFingerprintNames) {
            const ideal = await fm.idealResolver(name);
            if (ideal && ideal.ideal) {
                ++hasIdeal;
                if (ideal.ideal.sha === i.reason.analysis.fingerprints[name].sha) {
                    ++correctFingerprints;
                }
            }
        }
        const proportion = hasIdeal > 0 ? correctFingerprints / hasIdeal : 1;
        return {
            name: "ideals",
            score: Math.round(proportion * 5) as any,
        };
    };
}
