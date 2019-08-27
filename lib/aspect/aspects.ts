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
    adjustBy,
    branchCount,
    ChangelogAspect,
    CodeMetricsAspect,
    CodeOfConduct,
    CodeOwnership,
    ContributingAspect,
    ExposedSecrets,
    GitRecency,
    globAspect,
    License,
    LicensePresence,
} from "@atomist/sdm-pack-aspect";
import { LeinDeps } from "@atomist/sdm-pack-clojure";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    Aspect,
} from "@atomist/sdm-pack-fingerprints";
import { K8sSpecs } from "./k8s/spec";
import { CsProjectTargetFrameworks } from "./microsoft/CsProjectTargetFrameworks";
import { NpmDependencies } from "./node/npmDependencies";
import { TypeScriptVersion } from "./node/TypeScriptVersion";
import { commitRisk } from "./push/commitRisk";
import * as commonCommitRiskScorers  from "./push/commonCommitRiskScorers";
import { suggestTag } from "./push/suggestTag";
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
        DockerFrom,
        DockerfilePath,
        DockerPorts,
        License,
        // Based on license, decide the presence of a license: Not spread
        LicensePresence,
        SpringBootStarter,
        TypeScriptVersion,
        new CodeOwnership(),
        NpmDependencies,
        CodeOfConduct,
        ExposedSecrets,
        TravisScriptsAspect,
        branchCount,
        GitRecency,
        // This is expensive as it requires deeper cloning
        // gitActiveCommitters(30),
        // This is also expensive
        CodeMetricsAspect,
        // StackAspect,
        // CiAspect,
        // JavaBuild,
        // Don't show these
        globAspect({ name: "csproject", displayName: undefined, glob: "*.csproj" }),
        globAspect({ name: "snyk", displayName: undefined, glob: ".snyk" }),
        ChangelogAspect,
        ContributingAspect,
        globAspect({ name: "azure-pipelines", displayName: "Azure pipeline", glob: "azure-pipelines.yml" }),
        globAspect({ name: "readme", displayName: "Readme file", glob: "README.md" }),
        CsProjectTargetFrameworks,
        SpringBootVersion,
        // allMavenDependenciesAspect,    // This is expensive
        DirectMavenDependencies,
        PythonDependencies,
        K8sSpecs,
        LeinDeps,
        commitRisk({
            scorers: [
                commonCommitRiskScorers.fileChangeCount({ limitTo: 2 }),
                commonCommitRiskScorers.pomChanged(),
            ],
        }),
        suggestTag({ tag: "frivolous", reason: "You people are silly", test: async () => true }),
    ];
}
