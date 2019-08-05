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

import { LeinDeps } from "@atomist/sdm-pack-clojure/lib/fingerprints/clojure";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    filesAspect,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import { ManagedAspect } from "../aspect/AspectRegistry";
import {
    CodeMetricsAspect,
    CodeMetricsData,
    CodeMetricsType,
} from "../aspect/common/codeMetrics";
import { CodeOwnership } from "../aspect/common/codeOwnership";
import { fileCount } from "../aspect/common/fileCount";
import {
    CiAspect,
    JavaBuild,
    StackAspect,
} from "../aspect/common/stackAspect";
import { CodeOfConduct } from "../aspect/community/codeOfConduct";
import { License } from "../aspect/community/license";
import { conditionalize } from "../aspect/compose/conditionalize";
import {
    CombinationTagger,
    Tagger,
} from "../aspect/DefaultAspectRegistry";
import {
    branchCount,
    BranchCountType,
} from "../aspect/git/branchCount";
import {
    gitActiveCommitters,
    GitActivesType,
    GitRecency,
    GitRecencyType,
} from "../aspect/git/gitActivity";
import { idealsFromNpm } from "../aspect/node/idealFromNpm";
import { TsLintPropertyAspect } from "../aspect/node/TsLintAspect";
import { TypeScriptVersion } from "../aspect/node/TypeScriptVersion";
import { PythonDependencies } from "../aspect/python/pythonDependencies";
import { ExposedSecrets } from "../aspect/secret/exposedSecrets";
import { DirectMavenDependencies } from "../aspect/spring/directMavenDependencies";
import { SpringBootStarter } from "../aspect/spring/springBootStarter";
import { SpringBootVersion } from "../aspect/spring/springBootVersion";
import { TravisScriptsAspect } from "../aspect/travis/travisAspects";

import { daysSince } from "../aspect/git/dateUtils";

/**
 * The aspects anaged by this SDM.
 * Modify this list to customize with your own aspects.
 */
export const Aspects: ManagedAspect[] = [
    DockerFrom,
    DockerfilePath,
    DockerPorts,
    License,
    SpringBootStarter,
    TypeScriptVersion,
    new CodeOwnership(),
    {
        ...NpmDeps,
        suggestedIdeals: (type, name) => idealsFromNpm(name),
    },
    CodeOfConduct,
    ExposedSecrets,
    new TsLintPropertyAspect(),
    TravisScriptsAspect,
    fileCount,
    branchCount,
    GitRecency,
    // This is expensive as it requires deeper cloning
    gitActiveCommitters(50),
    // This is also expensive
    CodeMetricsAspect,
    StackAspect,
    CiAspect,
    JavaBuild,
    conditionalize(filesAspect({
            name: "node-gitignore",
            displayName: "Node git ignore",
            type: "node-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
    ), async p => p.hasFile("package.json")),
    conditionalize(filesAspect({
            name: "spring-gitignore",
            displayName: "git ignore",
            type: "spring-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
    ), async p => p.hasFile("pom.xml")),
    SpringBootVersion,
    // allMavenDependenciesAspect,    // This is expensive
    DirectMavenDependencies,
    PythonDependencies,
    LeinDeps,
];

export const Taggers: Tagger[] = [
    // fp => fp.type === NpmDeps.name ? `npm: ${fp.name}`: undefined,
    // fp => fp.type === DockerFrom.name ? `docker: ${fp.name}`: undefined,
    { name: "docker", description: "Docker status", test: fp => fp.type === DockerFrom.name },
    { name: "node", description: "Node", test: fp => fp.type === NpmDeps.name },
    { name: "maven", description: "Direct Maven dependencies", test: fp => fp.type === DirectMavenDependencies.name },
    { name: "typescript", description: "TypeScript version", test: fp => fp.type === TypeScriptVersion.name },
    { name: "clojure", description: "Lein dependencies", test: fp => fp.type === LeinDeps.name },
    { name: "spring-boot", description: "Spring Boot version", test: fp => fp.type === SpringBootVersion.name },
    { name: "travis", description: "Travis CI script", test: fp => fp.type === TravisScriptsAspect.name },
    { name: "python", description: "Python dependencies", test: fp => fp.type === PythonDependencies.name },
    {
        name: ">20 branches",
        description: "git branch count",
        test: fp => fp.type === BranchCountType && fp.data.count > 20,
    },
    {
        name: "huge (>10K)",
        description: "Repo size",
        test: fp => fp.type === CodeMetricsType && (fp.data as CodeMetricsData).lines > 10000,
    },
    {
        name: "big (3-10K)",
        description: "Repo size",
        test: fp => fp.type === CodeMetricsType && (fp.data as CodeMetricsData).lines > 3000 && (fp.data as CodeMetricsData).lines < 10000,
    },
    {
        name: "dead?", description: "Git activity",
        test: fp => {
            if (fp.type === GitRecencyType) {
                const date = new Date(fp.data);
                return daysSince(date) > 500;
            }
            return false;
        },
    },
];

export const CombinationTaggers: CombinationTagger[] = [
    // fps => _.uniq(fps.map(f => f.type)).length  + "",
    {
        name: "hot",
        description: "How hot is git",
        test: fps => {
            // Find recent repos
            const grt = fps.find(fp => fp.type === GitRecencyType);
            const acc = fps.find(fp => fp.type === GitActivesType);
            if (!!grt && !!acc) {
                // TODO can reduce days with non stale data
                const days = daysSince(new Date(grt.data));
                if (days < 10 && acc.data.count > 2) {
                    return true;
                }
            }
            return false;
        },
    },
];
