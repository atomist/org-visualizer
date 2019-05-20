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
    ManagedFeature,
    PossibleIdeal,
    PossibleIdeals,
    Scorer,
} from "@atomist/sdm-pack-analysis";
import {
    DockerFrom,
    FP,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import {
    deconstructNpmDepsFingerprintName,
    getNpmDepFingerprint,
} from "@atomist/sdm-pack-fingerprints/lib/fingerprints/npmDeps";
import { DefaultFeatureManager } from "../feature/DefaultFeatureManager";
import {
    NodeLibraryVersion,
} from "../feature/domain/NodeLibraryVersionFeature";
import {
    SpecificDockerBaseImage,
} from "../feature/domain/SpecificDockerBaseImageFeature";
import {
    TypeScriptVersion,
    TypeScriptVersionFeature,
} from "../feature/domain/TypeScriptVersionFeature";
import {
    Eliminate,
    FeatureManager,
    isDistinctIdeal,
} from "../feature/FeatureManager";

export const features: Array<ManagedFeature<any, any>> = [
    new TypeScriptVersionFeature(),
    DockerFrom,
    {
        ...NpmDeps,
        suggestIdeal: idealFromNpm,
    },
];

async function idealFromNpm(fingerprintName: string, cohort: FP[]): Promise<PossibleIdeals<FP>> {
    const libraryName = deconstructNpmDepsFingerprintName(fingerprintName);

    let world: PossibleIdeal<FP>;
    try {
        const result = await execPromise("npm", ["view", libraryName, "dist-tags.latest"]);
        logger.info(`World Ideal Version is ${result.stdout} for ${libraryName}`);
        world = {
            ideal: getNpmDepFingerprint(libraryName, result.stdout),
            reason: "latest from NPM",
        };
    } catch (err) {
        logger.error("Could not find version of " + libraryName + ": " + err.message);
    }

    return {
        world,
    };
}

// Group

const Ideals = {
    "npm-project-dep::axios": Eliminate,
    "npm-project-dep::lodash": new NodeLibraryVersion("lodash", "^4.17.11"),
    "npm-project-dep::atomist::sdm": new NodeLibraryVersion("@atomist/sdm", "1.5.0"),
    "tsVersion": new TypeScriptVersion("^3.4.5"),
    "docker-base-image-node": new SpecificDockerBaseImage("node", "11"),
};

export const featureManager = new DefaultFeatureManager(
    async name => {
        console.log(`Ideal for '${name}' is ${JSON.stringify(Ideals[name])}`);
        return Ideals[name];
    },
    ...features,
);

export function idealConvergenceScorer(fm: FeatureManager): Scorer {
    return async i => {
        const allFingerprintNames = Object.getOwnPropertyNames(i.reason.analysis.fingerprints);
        let correctFingerprints = 0;
        let hasIdeal = 0;
        for (const name of allFingerprintNames) {
            const ideal = await fm.idealResolver(name);
            if (isDistinctIdeal(ideal)) {
                ++hasIdeal;
                if (ideal.sha === i.reason.analysis.fingerprints[name].sha) {
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
