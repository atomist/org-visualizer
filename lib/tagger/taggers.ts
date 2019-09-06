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
    commonTaggers,
    isClassificationDataFingerprint,
    isFileMatchFingerprint,
    Tagger,
    TaggerDefinition,
} from "@atomist/sdm-pack-aspect";
import { LeinDeps } from "@atomist/sdm-pack-clojure/lib/fingerprints/clojure";
import { DockerFrom } from "@atomist/sdm-pack-docker";
import { PythonDependencies } from "../aspect/python/pythonDependencies";
import { DirectMavenDependencies } from "../aspect/spring/directMavenDependencies";
import { SpringBootVersion } from "../aspect/spring/springBootVersion";
import { TravisScriptsAspect } from "../aspect/travis/travisAspects";
import * as nodeTaggers from "./nodeTaggers";

import { CiAspect } from "../aspect/common/stackAspect";

export interface TaggersParams {

    /**
     * Max number of branches not to call out
     */
    maxBranches: number;

    /**
     * Number of days at which to consider a repo dead
     */
    deadDays: number;

    /**
     * Days since the last commit to indicate a hot repo
     */
    hotDays: number;

    /**
     * Number of committers needed to indicate a hot repo
     */
    hotContributors: number;
}

const DefaultTaggersParams: TaggersParams = {
    maxBranches: 20,
    deadDays: 365,
    hotDays: 2,
    hotContributors: 3,
};

/**
 * Add your own taggers
 * @param {Partial<TaggersParams>} opts
 * @return {Tagger[]}
 */
export function taggers(opts: Partial<TaggersParams>): Tagger[] {
    const optsToUse = {
        ...DefaultTaggersParams,
        ...opts,
    };
    return [
        commonTaggers.Vulnerable,
        // commonTaggers.isProblematic(),
        {
            name: "docker",
            description: "Docker status",
            test: async repo => repo.analysis.fingerprints.some(fp => fp.type === DockerFrom.name),
        },
        nodeTaggers.Node,
        {
            name: "maven",
            description: "Direct Maven dependencies",
            test: async repo => repo.analysis.fingerprints.some(fp => fp.type === DirectMavenDependencies.name),
        },
        nodeTaggers.TypeScript,
        nodeTaggers.TsLint,
        {
            name: "clojure", description: "Lein dependencies",
            test: async repo => repo.analysis.fingerprints.some(fp => fp.type === LeinDeps.name),
        },
        {
            name: "spring-boot", description: "Spring Boot version",
            test: async repo => repo.analysis.fingerprints.some(fp => fp.type === SpringBootVersion.name),
        },
        {
            name: "travis", description: "Travis CI script",
            test: async repo => repo.analysis.fingerprints.some(fp => fp.type === TravisScriptsAspect.name),
        },
        {
            name: "python", description: "Python dependencies",
            test: async repo => repo.analysis.fingerprints.some(fp => fp.type === PythonDependencies.name),
        },
        commonTaggers.Monorepo,
        nodeTaggers.usesNodeLibraryWhen({
            name: "angular",
            description: "Angular",
            test: library => library.includes("angular"),
        }),
        nodeTaggers.usesNodeLibrary({ library: "react" }),
        nodeTaggers.usesNodeLibrary({ library: "chai" }),
        nodeTaggers.usesNodeLibrary({ library: "mocha" }),
        {
            name: "jenkins",
            description: "Jenkins",
            test: async repo => repo.analysis.fingerprints
                .some(fp => isClassificationDataFingerprint(fp) && fp.type === CiAspect.name && fp.data.tags.includes("jenkins")),
        },
        {
            name: "circleci",
            description: "circleci",
            test: async repo => repo.analysis.fingerprints.some(
                fp => isClassificationDataFingerprint(fp) && fp.type === CiAspect.name && fp.data.tags.includes("circle")),
        },
        commonTaggers.inadequateReadme({ minLength: 200 }),
        commonTaggers.SoleCommitter,
        commonTaggers.excessiveBranchCount(optsToUse),
        commonTaggers.lineCountTest({ name: "huge (>10k)", lineCountTest: count => count > 10000 }),
        commonTaggers.lineCountTest({ name: "big (3-10k)", lineCountTest: count => count >= 3000 && count <= 10000 }),
        commonTaggers.lineCountTest({ name: "tiny (<200)", lineCountTest: count => count < 200 }),
        commonTaggers.HasCodeOfConduct,
        commonTaggers.HasChangeLog,
        commonTaggers.HasContributingFile,
        commonTaggers.HasLicense,
        commonTaggers.dead(optsToUse),
        ...combinationTaggers(optsToUse),
    ];
}

function combinationTaggers(opts: TaggersParams): Tagger[] {
    return [
        commonTaggers.gitHot(opts),
    ];
}
