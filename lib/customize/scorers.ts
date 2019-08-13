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

import { adjustBy } from "../scorer/scoring";

import { ScoreWeightings } from "@atomist/sdm-pack-analysis";
import {
    ShellLanguage,
    YamlLanguage,
} from "@atomist/sdm-pack-sloc/lib/languages";
import { RepositoryScorer } from "../aspect/AspectRegistry";
import { CodeOfConductType } from "../aspect/community/codeOfConduct";
import { TsLintType } from "../aspect/node/TsLintAspect";
import { TypeScriptVersionType } from "../aspect/node/TypeScriptVersion";
import {
    anchorScoreAt,
    limitLanguages,
    limitLinesOfCode,
    limitLinesOfCodeIn,
    penalizeForExcessiveBranches,
    PenalizeMonorepos,
    PenalizeNoLicense,
    requireRecentCommit,
} from "../scorer/commonScorers";
import {
    requireAspectOfType,
    requireGlobAspect,
} from "../scorer/scorerUtils";

export const scoreWeightings: ScoreWeightings = {
    // Weight this to penalize projects with few other scorers
    anchor: 3,
};

/**
 * Scorers to rate projects
 */
export const Scorers: RepositoryScorer[] = [
    anchorScoreAt(2),
    penalizeForExcessiveBranches({ branchLimit: 5 }),
    async repo => {
        const err = repo.tags.filter(t => t.severity === "error");
        const warn = repo.tags.filter(t => t.severity === "warn");
        const score = adjustBy(-3 * err.length - 2 * warn.length);
        return {
            name: "sev-count",
            score,
            reason: err.length + warn.length === 0 ?
                "No errors or warnings" :
                `Errors: [${err.map(e => e.name).join(",")}], warnings: [${warn.map(w => w.name).join(",")}]`,
        };
    },
    PenalizeMonorepos,
    typeScriptProjectsMustUseTsLint(),
    PenalizeNoLicense,
    limitLanguages({ limit: 4 }),
    // Adjust depending on the service granularity you want
    limitLinesOfCode({ limit: 30000 }),
    limitLinesOfCodeIn({ language: YamlLanguage, limit: 500 }),
    limitLinesOfCodeIn({ language: ShellLanguage, limit: 200 }),
    requireRecentCommit({ days: 30 }),
    requireAspectOfType({ type: CodeOfConductType, reason: "Repos should have a code of conduct" }),
    requireGlobAspect({ glob: "CHANGELOG.md" }),
    requireGlobAspect({ glob: "CONTRIBUTING.md" }),
];

export function typeScriptProjectsMustUseTsLint(): RepositoryScorer {
    return async repo => {
        // TypeScript projects must use tslint
        const isTs = repo.analysis.fingerprints.find(fp => fp.type === TypeScriptVersionType);
        if (!isTs) {
            return undefined;
        }
        const hasTsLint = repo.analysis.fingerprints.find(fp => fp.type === TsLintType);
        return {
            name: "has-tslint",
            score: hasTsLint ? 5 : 1,
            reason: hasTsLint ? "TypeScript projects should use tslint" : "TypeScript project using tslint",
        };
    };
}
