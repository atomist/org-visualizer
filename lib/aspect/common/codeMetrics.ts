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

import { Project } from "@atomist/automation-client";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import {
    calculateCodeMetrics,
    CodeMetrics,
} from "@atomist/sdm-pack-sloc";
import { Analyzed } from "../AspectRegistry";

export type CodeMetricsData = Pick<CodeMetrics,
    "languages" | "totalFiles" | "lines" | "files">;

/**
 * Scan for lines of code in particular programming languages.
 * Uses @atomist/sdm-pack-sloc
 */
async function scanForCodeMetrics(p: Project): Promise<CodeMetricsData> {
    const codeMetrics = await calculateCodeMetrics(p);
    const relevantLanguages = codeMetrics.languages.filter(l => l.total > 0);
    return {
        languages: relevantLanguages,
        files: codeMetrics.files,
        lines: codeMetrics.lines,
        totalFiles: codeMetrics.totalFiles,
    };
}

export const CodeMetricsType = "code-metrics";

export function isCodeMetricsFingerprint(fp: FP): fp is FP<CodeMetricsData> {
    const maybe = fp;
    return !!maybe && maybe.type === CodeMetricsType && maybe.data.languages !== undefined;
}

export const CodeMetricsAspect: Aspect<CodeMetricsData> = {
    name: CodeMetricsType,
    // Suppress display
    displayName: undefined,
    baseOnly: true,
    extract: async p => {
        const data = await scanForCodeMetrics(p);
        return {
            name: CodeMetricsType,
            type: CodeMetricsType,
            data,
            sha: sha256(JSON.stringify(data)),
        };
    },
    stats: {
        defaultStatStatus: {
            entropy: false,
        },
        basicStatsPath: "lines",
    },
};

export function findCodeMetricsData(a: Analyzed): CodeMetricsData | undefined {
    const fp = a.fingerprints.find(f => f.name === CodeMetricsType);
    return fp ? fp.data : undefined;
}
