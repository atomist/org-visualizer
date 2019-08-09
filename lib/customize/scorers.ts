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
import { BranchCountType } from "../aspect/git/branchCount";
import { RepositoryScorer } from "../scorer/scoring";

export const Scorers: RepositoryScorer[] = [
    async repo => {
        const branchCount = repo.analysis.fingerprints.find(f => f.type === BranchCountType);
        if (!branchCount) {
            return undefined;
        }
        let score: FiveStar = 5;
        const demerits = Math.min(branchCount.data.count % 5, 4);
        score = score - demerits as FiveStar;
        return branchCount ? {
            name: BranchCountType,
            score,
        } : undefined;
    },
    async repo => {
        let score: any = 5;
        const err = repo.tags.filter(t => t.severity === "error");
        const warn = repo.tags.filter(t => t.severity === "warn");
        score -= 3 * err.length;
        score -= 2 * warn.length;
        score = Math.max(score, 1) as FiveStar;
        return {
            name: "sev-count",
            score,
        };
    },
];
