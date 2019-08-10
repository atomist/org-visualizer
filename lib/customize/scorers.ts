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

import { BranchCountType } from "../aspect/git/branchCount";
import {
    adjustBy,
    RepositoryScorer,
} from "../scorer/scoring";

import { ScoreWeightings } from "@atomist/sdm-pack-analysis";
import * as _ from "lodash";

export const scoreWeightings: ScoreWeightings = {
    // Bias this to penalize projects with few other scorers
    "info-bias": 3,
};

/**
 * Scorers to rate projects
 */
export const Scorers: RepositoryScorer[] = [
    async () => {
        return {
            name: "info-bias",
            reason: "Weight to norm to penalize projects with little information",
            score: 3,
        };
    },
    async repo => {
        const branchCount = repo.analysis.fingerprints.find(f => f.type === BranchCountType);
        if (!branchCount) {
            return undefined;
        }
        // You get the first 2 branches for free. After that they start to cost
        const score = adjustBy(-(branchCount.data.count - 2) / 5);
        return branchCount ? {
            name: BranchCountType,
            score,
            reason: `${branchCount.data.count} branches`,
        } : undefined;
    },
    async repo => {
        const err = repo.tags.filter(t => t.severity === "error");
        const warn = repo.tags.filter(t => t.severity === "warn");
        const score = adjustBy(-3 * err.length - 2 * warn.length);
        return {
            name: "sev-count",
            score,
            reason: `Errors: ${err.map(e => e.name).join(",")}, warnings: ${warn.map(w => w.name).join(",")}`,
        };
    },
    async repo => {
        const distinctPaths = _.uniq(repo.analysis.fingerprints.map(t => t.path)).length;
        return {
            name: "sev-count",
            score: adjustBy(1 - distinctPaths),
            reason: distinctPaths > 1 ?
                `${distinctPaths} virtual projects: Prefer one project per repository` :
                "Single project in repository",
        };
    },
];
