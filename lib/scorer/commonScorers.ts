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
import { RepositoryScorer } from "../aspect/AspectRegistry";
import {
    CodeMetricsData,
    CodeMetricsType,
} from "../aspect/common/codeMetrics";
import { daysSince } from "../aspect/git/dateUtils";
import {
    GitRecencyData,
    GitRecencyType,
} from "../aspect/git/gitActivity";
import { adjustBy } from "./scoring";

export function anchorScoreAt(score: FiveStar): RepositoryScorer {
    return async () => {
        return {
            name: "anchor",
            reason: `Weight to ${score} stars to penalize repositories about which we know little`,
            score,
        };
    };
}

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
