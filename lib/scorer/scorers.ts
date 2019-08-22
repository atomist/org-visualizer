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
    CodeOfConductType,
    commonScorers,
    RepositoryScorer,
    requireAspectOfType,
    requireGlobAspect,
} from "@atomist/sdm-pack-aspect";
import {
    PowerShellLanguage,
    ShellLanguage,
    YamlLanguage,
} from "@atomist/sdm-pack-sloc/lib/languages";

import { TypeScriptProjectsMustUseTsLint } from "./nodeScorers";

/**
 * Scorers to rate projects
 */
export function scorers(): RepositoryScorer[] {
    return [
        commonScorers.anchorScoreAt(2),
        commonScorers.penalizeForExcessiveBranches({ branchLimit: 5 }),
        commonScorers.PenalizeWarningAndErrorTags,
        commonScorers.PenalizeMonorepos,
        TypeScriptProjectsMustUseTsLint,
        commonScorers.PenalizeNoLicense,
        commonScorers.limitLanguages({ limit: 4 }),
        // Adjust depending on the service granularity you want
        commonScorers.limitLinesOfCode({ limit: 30000 }),
        commonScorers.limitLinesOfCodeIn({ language: YamlLanguage, limit: 500, freeAmount: 200 }),
        commonScorers.limitLinesOfCodeIn({ language: PowerShellLanguage, limit: 200, freeAmount: 100 }),
        commonScorers.limitLinesOfCodeIn({ language: ShellLanguage, limit: 200, freeAmount: 100 }),
        commonScorers.requireRecentCommit({ days: 30 }),
        requireAspectOfType({ type: CodeOfConductType, reason: "Repos should have a code of conduct" }),
        requireGlobAspect({ glob: "CHANGELOG.md" }),
        requireGlobAspect({ glob: "CONTRIBUTING.md" }),
    ];
}
