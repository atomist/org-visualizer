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
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    filesFeature,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import { CodeOfConductFeature } from "../element/codeOfConduct";
import { CodeOwnershipFeature } from "../element/codeOwnership";
import { ManagedAspect } from "../feature/AspectRegistry";
import {
    branchCount,
    fileCountFeature,
} from "../feature/common/count";
import {
    CiFeature,
    JavaBuildFeature,
    StackFeature,
} from "../feature/common/stackFeature";
import { conditionalize } from "../feature/compose/conditionalize";
import { GitRecencyFeature } from "../feature/git/gitActivityScanner";
import { idealsFromNpm } from "../feature/node/idealFromNpm";
import { TsLintPropertyFeature } from "../feature/node/TsLintFeature";
import { TypeScriptVersionFeature } from "../feature/node/TypeScriptVersionFeature";
import { pythonDependenciesFeature } from "../feature/python/pythonDependenciesFeature";
import { DirectMavenDependenciesFeature } from "../feature/spring/directMavenDependenciesFeature";
import { SpringBootStarterFeature } from "../feature/spring/springBootStarterFeature";
import { SpringBootVersionFeature } from "../feature/spring/springBootVersionFeature";
import { TravisScriptsFeature } from "../feature/travis/travisFeatures";

/**
 * The features managed by this SDM.
 * Modify this list to customize with your own features.
 */
export const Features: ManagedAspect[] = [
    DockerFrom,
    DockerfilePath,
    DockerPorts,
    SpringBootStarterFeature,
    TypeScriptVersionFeature,
    new CodeOwnershipFeature(),
    {
        ...NpmDeps,
        suggestedIdeals: (type, name) => idealsFromNpm(name),
    },
    CodeOfConductFeature,
    new TsLintPropertyFeature(),
    TravisScriptsFeature,
    fileCountFeature,
    branchCount,
    GitRecencyFeature,
    StackFeature,
    CiFeature,
    JavaBuildFeature,
    conditionalize(filesFeature({
            name: "node-git-ignore",
            displayName: "Node git ignore",
            type: "node-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
    ), {
        name: "node-git-ignore",
        displayName: "Node git ignore",
        toDisplayableFingerprintName: () => "Node git ignore",
        toDisplayableFingerprint: fp => fp.sha,
    }, async p => p.hasFile("package.json")),
    conditionalize(filesFeature({
            name: "spring-git-ignore",
            displayName: "git ignore",
            type: "spring-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
    ), {
        name: "spring-git-ignore",
        displayName: "Spring git ignore",
        toDisplayableFingerprintName: () => "Spring git ignore",
        toDisplayableFingerprint: fp => fp.sha,
    }, async p => p.hasFile("pom.xml")),
    SpringBootVersionFeature,
    // allMavenDependenciesFeature,    // This is expensive
    DirectMavenDependenciesFeature,
    pythonDependenciesFeature,
];
