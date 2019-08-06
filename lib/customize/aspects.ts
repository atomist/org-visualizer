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

import * as _ from "lodash";

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

export function taggers(opts: Partial<TaggersParams>): Tagger[] {
    const optsToUse = {
        ...DefaultTaggersParams,
        ...opts,
    };
    return [
        { name: "vulnerable", description: "Has exposed secrets", test: fp => fp.type === ExposedSecrets.name },
        { name: "docker", description: "Docker status", test: fp => fp.type === DockerFrom.name },
        { name: "node", description: "Node", test: fp => fp.type === NpmDeps.name },
        {
            name: "maven",
            description: "Direct Maven dependencies",
            test: fp => fp.type === DirectMavenDependencies.name,
        },
        { name: "typescript", description: "TypeScript version", test: fp => fp.type === TypeScriptVersion.name },
        { name: "clojure", description: "Lein dependencies", test: fp => fp.type === LeinDeps.name },
        { name: "spring-boot", description: "Spring Boot version", test: fp => fp.type === SpringBootVersion.name },
        { name: "travis", description: "Travis CI script", test: fp => fp.type === TravisScriptsAspect.name },
        { name: "python", description: "Python dependencies", test: fp => fp.type === PythonDependencies.name },
        {
            name: "solo",
            description: "Projects with one committer",
            test: fp => fp.type === GitActivesType && fp.data.count === 1,
        },
        {
            name: `>${optsToUse.maxBranches} branches`,
            description: "git branch count",
            test: fp => fp.type === BranchCountType && fp.data.count > optsToUse.maxBranches,
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
            name: "dead?", description: `No git activity in last ${optsToUse.deadDays} days`,
            test: fp => {
                if (fp.type === GitRecencyType) {
                    const date = new Date(fp.data);
                    return daysSince(date) > optsToUse.deadDays;
                }
                return false;
            },
        },
    ];
}

export interface CombinationTaggersParams {

    /**
     * Mininum number of aspects to expect to indicate adequate project understanding
     */
    minAspectsToExpect: number;

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
    minAspectsToExpect: 9,
    hotDays: 10,
    hotContributors: 2,
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
            test: fps => {
                const aspectCount = _.uniq(fps.map(f => f.type)).length;
                // There are quite a few aspects that are found on everything, e.g. git
                // We need to set the threshold count probably
                return aspectCount < optsToUse.minAspectsToExpect;
            },
        },
        {
            name: "hot",
            description: "How hot is git",
            test: fps => {
                const grt = fps.find(fp => fp.type === GitRecencyType);
                const acc = fps.find(fp => fp.type === GitActivesType);
                if (!!grt && !!acc) {
                    const days = daysSince(new Date(grt.data));
                    if (days < optsToUse.hotDays && acc.data.count > optsToUse.hotContributors) {
                        return true;
                    }
                }
                return false;
            },
        },
    ];
}
