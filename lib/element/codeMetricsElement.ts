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
    TechnologyElement,
    TechnologyScanner,
} from "@atomist/sdm-pack-analysis";
import {
    calculateCodeMetrics,
    CodeMetrics,
} from "@atomist/sdm-pack-sloc";

export interface CodeMetricsElement extends TechnologyElement,
    Pick<CodeMetrics, "languages" | "totalFiles" | "lines" | "files"> {

    name: "codemetrics";

}

/**
 * Scan for lines of code in particular programming languages.
 * Uses @atomist/sdm-pack-sloc
 */
export const codeMetricsScanner: TechnologyScanner<CodeMetricsElement> = async p => {
    const codeMetrics = await calculateCodeMetrics(p);
    const relevantLanguages = codeMetrics.languages.filter(l => l.total > 0);
    const tags = relevantLanguages.map(lr => lr.language.name);
    return {
        name: "codemetrics",
        tags,
        languages: relevantLanguages,
        files: codeMetrics.files,
        lines: codeMetrics.lines,
        totalFiles: codeMetrics.totalFiles,
    };
};
