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

import { logger } from "@atomist/automation-client";
import {
    AspectRegistry,
    CombinationTagger,
    Tagger,
    WorkspaceSpecificTagger,
} from "../aspect/AspectRegistry";
import { isCodeMetricsFingerprint } from "../aspect/common/codeMetrics";
import { CodeOfConductType } from "../aspect/community/codeOfConduct";
import {
    hasNoLicense,
    isLicenseFingerprint,
} from "../aspect/community/license";
import { isGlobMatchFingerprint } from "../aspect/compose/globAspect";
import { BranchCountType } from "../aspect/git/branchCount";
import { daysSince } from "../aspect/git/dateUtils";
import {
    GitActivesType,
    GitRecencyType,
} from "../aspect/git/gitActivity";
import { ExposedSecrets } from "../aspect/secret/exposedSecrets";

export const Monorepo: Tagger = {
    name: "monorepo",
    description: "Contains multiple virtual projects",
    severity: "warn",
    test: fp => !!fp.path && fp.path.length > 0,
};

export const Vulnerable: Tagger = {
    name: "vulnerable",
    description: "Has exposed secrets", test: fp => fp.type === ExposedSecrets.name,
    severity: "error",
};

export const HasLicense: Tagger = {
    name: "license",
    description: "Repositories should have a license",
    test: fp => isLicenseFingerprint(fp) && !hasNoLicense(fp.data),
};

export const HasCodeOfConduct: Tagger = {
    name: "code-of-conduct",
    description: "Repositories should have a code of conduct",
    test: fp => fp.type === CodeOfConductType,
};

export const HasChangeLog: Tagger = globRequired({
        name: "changelog",
        description: "Repositories should have a changelog",
        glob: "CHANGELOG.md",
    });

export const HasContributingFile: Tagger = globRequired({
    name: "contributing",
    description: "Repositories should have a contributing",
    glob: "CONTRIBUTING.md",
});

/**
 * Tag projects as dead if they haven't been committed to recently
 * @param {{days: number}} opts number of days at which to conclude a project is dead
 * @return {Tagger}
 */
export function dead(opts: { deadDays: number }): Tagger {
    return {
        name: "dead?",
        description: `No git activity in last ${opts.deadDays} days`,
        severity: "error",
        test: fp => {
            if (fp.type === GitRecencyType) {
                const date = new Date(fp.data);
                return daysSince(date) > opts.deadDays;
            }
            return false;
        },
    };
}

export const SoleCommitter: Tagger = {
    name: "sole-committer",
    description: "Projects with one committer",
    test: fp => fp.type === GitActivesType && fp.data.count === 1,
};

export function excessiveBranchCount(opts: { maxBranches: number }): Tagger {
    return {
        name: `>${opts.maxBranches} branches`,
        description: "git branch count",
        severity: "warn",
        test: fp => fp.type === BranchCountType && fp.data.count > opts.maxBranches,
    };
}

export function lineCountTest(opts: { name: string, lineCountTest: (lineCount: number) => boolean }): Tagger {
    return {
        name: opts.name,
        description: "Repo size",
        test: fp => isCodeMetricsFingerprint(fp) && opts.lineCountTest(fp.data.lines),
    };
}

export function globRequired(opts: { name: string, description: string, glob: string }): Tagger {
    return {
        ...opts,
        test: fp => isGlobMatchFingerprint(fp) && fp.data.glob === opts.glob && fp.data.matches.length > 0,
    };
}

/**
 * Flag repos with known undesirable usages
 */
export const isProblematic: WorkspaceSpecificTagger = {
    name: "problems",
    create: async (workspaceId: string, aspectRegistry: AspectRegistry) => {
        logger.info("Creating problem tagger for workspace %s", workspaceId);
        const checker = await aspectRegistry.undesirableUsageCheckerFor(workspaceId);
        return {
            name: "problems",
            description: "Undesirable usage",
            severity: "error",
            test: fp => {
               const problem = checker.check(fp, workspaceId);
               return !!problem;
            },
        };
    },
};

export function gitHot(opts: { name?: string, hotDays: number, hotContributors: number }): CombinationTagger {
    return {
        name: opts.name || "hot",
        description: "How hot is git",
        test: fps => {
            const grt = fps.find(fp => fp.type === GitRecencyType);
            const acc = fps.find(fp => fp.type === GitActivesType);
            if (!!grt && !!acc) {
                const days = daysSince(new Date(grt.data));
                if (days < opts.hotDays && acc.data.count > opts.hotContributors) {
                    return true;
                }
            }
            return false;
        },
    };
}

export function inadequateReadme(opts: { minLength: number}): Tagger {
    return {
        name: "poor-readme",
        description: "README is adequate",
        severity: "warn",
        test: fp => isGlobMatchFingerprint(fp) &&
            fp.data.glob === "README.md" && (fp.data.matches.length === 0 || fp.data.matches[0].size < opts.minLength),
    };
}
