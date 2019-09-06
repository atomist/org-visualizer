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
    BranchCount,
    ChangelogAspect,
    CodeMetricsAspect,
    codeOfConduct,
    codeOwnership,
    ContributingAspect,
    ExposedSecrets,
    gitActiveCommitters,
    GitRecency,
    globAspect,
    license,
    LicensePresence,
} from "@atomist/sdm-pack-aspect";
import { buildTimeAspect } from "@atomist/sdm-pack-aspect/lib/aspect/delivery/BuildAspect";
import { LeinDeps } from "@atomist/sdm-pack-clojure";
import { DockerfilePath, DockerFrom, DockerPorts } from "@atomist/sdm-pack-docker";
import { Aspect } from "@atomist/sdm-pack-fingerprint";
import { filesAspect } from "@atomist/sdm-pack-fingerprints";
import { CiAspect, JavaBuild, StackAspect } from "./common/stackAspect";
import { githubAspect } from "./github/githubAspect";
import { K8sSpecs } from "./k8s/spec";
import { NpmDependencies } from "./node/npmDependencies";
import { TypeScriptVersion } from "./node/TypeScriptVersion";
import { PythonVersion } from "./python/python2to3";
import { PythonDependencies } from "./python/pythonDependencies";
import { DirectMavenDependencies } from "./spring/directMavenDependencies";
import { SpringBootStarter } from "./spring/springBootStarter";
import { SpringBootVersion } from "./spring/springBootVersion";
import { TravisScriptsAspect } from "./travis/travisAspects";

/**
 * The aspects managed by this SDM.
 * Modify this list to customize with your own aspects.
 */
export function aspects(): Aspect[] {
    return [
        PythonVersion,
        DockerFrom,
        DockerfilePath,
        DockerPorts,
        license(),
        // Based on license, decide the presence of a license: Not spread
        LicensePresence,
        SpringBootStarter,
        TypeScriptVersion,
        codeOwnership(),
        NpmDependencies,
        codeOfConduct(),
        ExposedSecrets,
        TravisScriptsAspect,
        BranchCount,
        GitRecency,
        gitActiveCommitters({ commitDepth: 30 }),
        githubAspect(process.env.GITHUB_TOKEN),
        CodeMetricsAspect,
        StackAspect,
        CiAspect,
        JavaBuild,
        // Don't show these
        ChangelogAspect,
        ContributingAspect,
        globAspect({ name: "readme", displayName: "Readme file", glob: "README.md" }),
        SpringBootVersion,
        // allMavenDependenciesAspect,    // This is expensive
        DirectMavenDependencies,
        PythonDependencies,
        K8sSpecs,
        LeinDeps,

        // Time builds
        buildTimeAspect(),

        filesAspect({
                name: "gradle",
                type: "gradle",
                displayName: undefined,
                canonicalize: content => content,
            },
            "build.gradle"),

        // Asks for human intervention to tag the commit
        // suggestTag({ tag: "frivolous", reason: "You people are silly", test: async () => true }),
        // Show confirmed tag information
        // ConfirmedTags,
    ];
}
