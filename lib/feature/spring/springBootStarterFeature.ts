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
    Feature,
    FP,
    sha256,
} from "@atomist/sdm-pack-fingerprints";
import { VersionedArtifact } from "@atomist/sdm-pack-spring";
import { findDeclaredDependencies } from "@atomist/sdm-pack-spring/lib/maven/parse/fromPom";
import { DocumentedFeature } from "../DocumentedFeature";

const SpringBootStarterType = "spring-boot-starter";

export interface SpringBootStarterFingerprint extends FP {
    data: VersionedArtifact;
}

/**
 * Detect which Spring Boot starter dependencies are included in your projects,
 * and which versions.
 *
 * This includes maven dependencies ending in "-starter"
 *
 * The fingerprint includes the whole
 * [VersionedArtifact](https://atomist.github.io/sdm-pack-spring/interfaces/_lib_maven_versionedartifact_.versionedartifact.html)
 *
 * Only the version is displayed (or "inherited" if the version is empty).
 */
export const SpringBootStarterFeature: Feature<SpringBootStarterFingerprint> & DocumentedFeature = {
    name: SpringBootStarterType,
    displayName: "Spring Boot Starter",
    extract: async p => {
        const deps = await findDeclaredDependencies(p);
        if (deps.dependencies.length === 0) {
            return undefined;
        }
        return deps.dependencies
            .filter(d => d.artifact.includes("-starter"))
            .map(createSpringBootStarterFingerprint);
    },
    toDisplayableFingerprint: fp => {
        return fp.data.version || "inherited";
    },
    documentationUrl:
        "https://atomist-blogs.github.io/org-visualizer/modules/_lib_feature_spring_springbootstarterfeature_.html#springbootstarterfeature",
};

function createSpringBootStarterFingerprint(data: VersionedArtifact): SpringBootStarterFingerprint {
    return {
        type: SpringBootStarterType,
        name: `starter:${data.group}:${data.artifact}`,
        data,
        sha: sha256(JSON.stringify(data)),
    };
}
