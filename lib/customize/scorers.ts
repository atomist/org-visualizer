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

import { ScoreWeightings } from "@atomist/sdm-pack-analysis";
import {
    PowerShellLanguage,
    ShellLanguage,
    YamlLanguage,
} from "@atomist/sdm-pack-sloc/lib/languages";
import { RepositoryScorer } from "../aspect/AspectRegistry";
import { CodeOfConductType } from "../aspect/community/codeOfConduct";
import {
    anchorScoreAt,
    limitLanguages,
    limitLinesOfCode,
    limitLinesOfCodeIn,
    penalizeForExcessiveBranches,
    PenalizeMonorepos,
    PenalizeNoLicense,
    PenalizeWarningAndErrorTags,
    requireRecentCommit,
} from "../scorer/commonScorers";
import { TypeScriptProjectsMustUseTsLint } from "../scorer/nodeScorers";
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
    PenalizeWarningAndErrorTags,
    PenalizeMonorepos,
    TypeScriptProjectsMustUseTsLint,
    PenalizeNoLicense,
    limitLanguages({ limit: 4 }),
    // Adjust depending on the service granularity you want
    limitLinesOfCode({ limit: 30000 }),
    limitLinesOfCodeIn({ language: YamlLanguage, limit: 500, freeAmount: 200 }),
    limitLinesOfCodeIn({ language: PowerShellLanguage, limit: 200, freeAmount: 100 }),
    limitLinesOfCodeIn({ language: ShellLanguage, limit: 200, freeAmount: 100 }),
    requireRecentCommit({ days: 30 }),
    requireAspectOfType({ type: CodeOfConductType, reason: "Repos should have a code of conduct" }),
    requireGlobAspect({ glob: "CHANGELOG.md" }),
    requireGlobAspect({ glob: "CONTRIBUTING.md" }),
];
