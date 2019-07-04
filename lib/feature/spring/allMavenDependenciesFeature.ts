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

const MavenDepsType = "maven-deps";

/**
 * Emits direct and transitive dependencies.
 * Requires running Maven, so expensive
 */
export const allMavenDependenciesFeature: Feature = {
    name: MavenDepsType,
    displayName: "Maven dependency tree",
    extract: async p => {
        const pom = await p.getFile("pom.xml");
        if (!pom) {
            return undefined;
        }
        const pomContent = await pom.getContent();
        const allDeps = await findDependenciesFromEffectivePom(p);
        return allDeps
            .map(dep => ({
                ...dep,
                // TODO this is probably wrong
                direct: pomContent.includes(`<group>${dep.group}</group>`) &&
                    pomContent.includes(`<artifact>${dep.group}</artifact>`),
            }))
            .map(gavToFingerprint);
    },
    toDisplayableFingerprintName: name => name,
    toDisplayableFingerprint: fp => {
        const version = JSON.parse(fp.data).version || "no version";
        return version;
    },
};

function gavToFingerprint(gav: VersionedArtifact & { direct: boolean }): FP {
    const data = JSON.stringify(gav);
    return {
        type: MavenDepsType,
        name: `${gav.group}:${gav.artifact}`,
        abbreviation: "mvn",
        version: "0.1.0",
        data,
        sha: sha256(data),
    };
}
