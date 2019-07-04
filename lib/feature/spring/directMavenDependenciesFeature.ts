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

import { Feature, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import {
    findDependenciesFromEffectivePom,
    VersionedArtifact,
} from "@atomist/sdm-pack-spring";
import { findDeclaredDependencies } from "@atomist/sdm-pack-spring/lib/maven/parse/fromPom";

const MavenDirectDep = "maven-direct-dep";

/**
 * Emits direct dependencies only
 */
export const directMavenDependenciesFeature: Feature = {
    name: MavenDirectDep,
    displayName: "Direct Maven dependencies",
    extract: async p => {
        const deps = await findDeclaredDependencies(p);
        return deps.dependencies.map(gavToFingerprint);
    },
    apply: async (p, fp) => {
        // TODO implement this
        return false;
    },
    toDisplayableFingerprintName: name => name,
    toDisplayableFingerprint: fp => {
        const version = JSON.parse(fp.data).version;
        return version;
    },
};

function gavToFingerprint(gav: VersionedArtifact): FP {
    const data = JSON.stringify(gav);
    return {
        type: MavenDirectDep,
        name: `${gav.group}:${gav.artifact}`,
        abbreviation: "mvn",
        version: "0.1.0",
        data,
        sha: sha256(data),
    };
}
