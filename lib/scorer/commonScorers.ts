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

import { FiveStar } from "@atomist/sdm-pack-analysis";
import { FP } from "@atomist/sdm-pack-fingerprints";
import { Language } from "@atomist/sdm-pack-sloc/lib/slocReport";
import * as _ from "lodash";
import { RepositoryScorer } from "../aspect/AspectRegistry";
import {
    CodeMetricsData,
    CodeMetricsType,
} from "../aspect/common/codeMetrics";
import { hasNoLicense, LicenseType } from "../aspect/community/license";
import { BranchCountType } from "../aspect/git/branchCount";
import { daysSince } from "../aspect/git/dateUtils";
import {
    GitRecencyData,
    GitRecencyType,
} from "../aspect/git/gitActivity";
import { adjustBy } from "./scoring";

/**
 * Use to anchor scores to penalize repositories about which we know little.
 * Typically weighted > default x1
 */
export function anchorScoreAt(score: FiveStar): RepositoryScorer {
    return async () => {
        return {
            name: "anchor",
            reason: `Weight to ${score} stars to penalize repositories about which we know little`,
            score,
        };
    };
}

/**
 * Penalize repositories for not having a recent commit.
 * days is the number of days since the latest commit to the default branch
 * that will cost 1 star.
 */
export function requireRecentCommit(opts: { days: number }): RepositoryScorer {
    return async repo => {
        const grt = repo.analysis.fingerprints.find(fp => fp.type === GitRecencyType) as FP<GitRecencyData>;
        if (!grt) {
            return undefined;
        }
        const date = new Date(grt.data.lastCommitTime);
        const days = daysSince(date);
        return {
            name: "recency",
            score: adjustBy(-days / opts.days),
            reason: `Last commit ${days} days ago`,
        };
    };
}

/**
 * Limit languages used in a project
 */
export function limitLanguages(opts: { limit: number }): RepositoryScorer {
    return async repo => {
        const cm = repo.analysis.fingerprints.find(fp => fp.type === CodeMetricsType) as FP<CodeMetricsData>;
        if (!cm) {
            return undefined;
        }
        return {
            name: "multi-language",
            score: adjustBy(opts.limit - cm.data.languages.length),
            reason: `Found ${cm.data.languages.length} languages: ${cm.data.languages.map(l => l.language.name).join(",")}`,
        };
    };
}

/**
 * Penalize repositories for having too many lines of code.
 * The limit is the number of lines of code required to drop one star.
 * The chosen limit will depend on team preferences: For example,
 * are we trying to do microservices?
 */
export function limitLinesOfCode(opts: { limit: number }): RepositoryScorer {
    return async repo => {
        const cm = repo.analysis.fingerprints.find(fp => fp.type === CodeMetricsType) as FP<CodeMetricsData>;
        if (!cm) {
            return undefined;
        }
        return {
            name: "total-loc",
            score: adjustBy(-cm.data.lines / opts.limit),
            reason: `Found ${cm.data.lines} total lines of code`,
        };
    };
}

export function limitLinesOfCodeIn(opts: { limit: number, language: Language }): RepositoryScorer {
    return async repo => {
        const cm = repo.analysis.fingerprints.find(fp => fp.type === CodeMetricsType) as FP<CodeMetricsData>;
        if (!cm) {
            return undefined;
        }
        const target = cm.data.languages.find(l => l.language.name === opts.language.name);
        const targetLoc = target ? target.total : 0;
        return {
            name: `limit-${opts.language.name} (${opts.limit})`,
            score: adjustBy(-targetLoc / opts.limit),
            reason: `Found ${targetLoc} lines of ${opts.language.name}`,
        };
    };
}

export function penalizeForExcessiveBranches(opts: { branchLimit: number }): RepositoryScorer {
    return async repo => {
        const branchCount = repo.analysis.fingerprints.find(f => f.type === BranchCountType);
        if (!branchCount) {
            return undefined;
        }
        // You get the first 2 branches for free. After that they start to cost
        const score = adjustBy(-(branchCount.data.count - 2) / opts.branchLimit);
        return branchCount ? {
            name: BranchCountType,
            score,
            reason: `${branchCount.data.count} branches: Should not have more than ${opts.branchLimit}`,
        } : undefined;
    };
}

export const PenalizeMonorepos: RepositoryScorer =
    async repo => {
        const distinctPaths = _.uniq(repo.analysis.fingerprints.map(t => t.path)).length;
        return {
            name: "monorepo",
            score: adjustBy(1 - distinctPaths / 2),
            reason: distinctPaths > 1 ?
                `${distinctPaths} virtual projects: Prefer one project per repository` :
                "Single project in repository",
        };
    };

export const PenalizeNoLicense: RepositoryScorer =
    async repo => {
        const license = repo.analysis.fingerprints.find(fp => fp.type === LicenseType);
        const bad = !license || hasNoLicense(license.data);
        return {
            name: "license",
            score: bad ? 1 : 5,
            reason: bad ? "Repositories should have a license" : "Repository has a license",
        };
    };
