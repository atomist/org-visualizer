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
import { DockerFrom } from "@atomist/sdm-pack-docker";
import * as _ from "lodash";
import { CombinationTagger, Tagger, } from "../aspect/AspectRegistry";
import { CiAspect } from "../aspect/common/stackAspect";
import { isFileMatchFingerprint } from "../aspect/compose/fileMatchAspect";
import { PythonDependencies } from "../aspect/python/pythonDependencies";
import { DirectMavenDependencies } from "../aspect/spring/directMavenDependencies";
import { SpringBootVersion } from "../aspect/spring/springBootVersion";
import { TravisScriptsAspect } from "../aspect/travis/travisAspects";
import * as commonTaggers from "../tagger/commonTaggers";
import * as nodeTaggers from "../tagger/nodeTaggers";

export interface TaggersParams {

    /**
     * Max number of branches not to call out
     */
    maxBranches: number;

    /**
     * Number of days at which to consider a repo dead
     */
    deadDays: number;
}

const DefaultTaggersParams: TaggersParams = {
    maxBranches: 20,
    deadDays: 365,
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
        { name: "docker", description: "Docker status", test: fp => fp.type === DockerFrom.name },
        nodeTaggers.Node,
        {
            name: "maven",
            description: "Direct Maven dependencies",
            test: fp => fp.type === DirectMavenDependencies.name,
        },
        nodeTaggers.TypeScript,
        nodeTaggers.TsLint,
        { name: "clojure", description: "Lein dependencies", test: fp => fp.type === LeinDeps.name },
        { name: "spring-boot", description: "Spring Boot version", test: fp => fp.type === SpringBootVersion.name },
        { name: "travis", description: "Travis CI script", test: fp => fp.type === TravisScriptsAspect.name },
        { name: "python", description: "Python dependencies", test: fp => fp.type === PythonDependencies.name },
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
            test: fp => fp.type === CiAspect.name && fp.data.includes("jenkins"),
        },
        {
            name: "circleci",
            description: "circleci",
            test: fp => fp.type === CiAspect.name && fp.data.includes("circle"),
        },
        {
            name: "azure-pipelines",
            description: "Azure pipelines files",
            test: fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("azure-pipeline") && fp.data.matches.length > 0,
        },
        commonTaggers.globRequired({
            name: "snyk",
            description: "Snyk policy",
            glob: ".snyk",
        }),
        {
            // TODO allow to use #
            name: "CSharp",
            description: "C# build",
            test: fp => isFileMatchFingerprint(fp) &&
                fp.name.includes("csproj") && fp.data.matches.length > 0,
        },
        commonTaggers.SoleCommitter,
        commonTaggers.excessiveBranchCount(optsToUse),
        commonTaggers.lineCountTest({ name: "huge (>10k)", lineCountTest: count => count > 10000 }),
        commonTaggers.lineCountTest({ name: "big (3-10k)", lineCountTest: count => count >= 3000 && count <= 10000 }),
        commonTaggers.lineCountTest({ name: "tiny (<200)", lineCountTest: count => count < 200 }),
        commonTaggers.HasCodeOfConduct,
        commonTaggers.globRequired({
            name: "changelog",
            description: "Repositories should have a changelog",
            glob: "CHANGELOG.md",
        }),
        commonTaggers.globRequired({
            name: "contributing",
            description: "Repositories should have a contributing",
            glob: "CONTRIBUTING.md",
        }),
        commonTaggers.HasLicense,
        commonTaggers.dead(optsToUse),
    ];
}

export interface CombinationTaggersParams {

    /**
     * Mininum percentage of average aspect count (fraction) to expect to indicate adequate project understanding
     */
    minAverageAspectCountFractionToExpect: number;

    /**
     * Days since the last commit to indicate a hot repo
     */
    hotDays: number;

    /**
     * Number of committers needed to indicate a hot repo
     */
    hotContributors: number;
}

// TODO can reduce days with non stale data
const DefaultCombinationTaggersParams: CombinationTaggersParams = {
    minAverageAspectCountFractionToExpect: .75,
    hotDays: 3,
    hotContributors: 3,
};

export function combinationTaggers(opts: Partial<CombinationTaggersParams>): CombinationTagger[] {
    const optsToUse = {
        ...DefaultCombinationTaggersParams,
        ...opts,
    };
    return [
        {
            name: "not understood",
            description: "You may want to write aspects for these outlier projects",
            severity: "warn",
            test: (fps, id, tagContext) => {
                const aspectCount = _.uniq(fps.map(f => f.type)).length;
                // There are quite a few aspects that are found on everything, e.g. git
                // We need to set the threshold count probably
                return aspectCount < tagContext.averageFingerprintCount * optsToUse.minAverageAspectCountFractionToExpect;
            },
        },
        commonTaggers.gitHot(optsToUse),
    ];
}
