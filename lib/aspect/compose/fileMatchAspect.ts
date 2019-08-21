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
    FileParser,
} from "@atomist/automation-client";
import { fileHitIterator } from "@atomist/automation-client/lib/tree/ast/astUtils";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { Omit } from "../../util/omit";

export interface FileMatch {
    filePath: string;
    pathExpression: string;
    matchValue: string;
}

const FileMatchType = "file-match";
type FileMatchType = "file-match";

export interface FileMatchData {
    kind: FileMatchType;
    glob: string;
    matches: FileMatch[];
}

export function isFileMatchFingerprint(fp: FP): fp is FP<FileMatchData> {
    const maybe = fp.data as FileMatchData;
    return !!maybe && maybe.kind === FileMatchType && maybe.kind === "file-match" && !!maybe.glob;
}

export interface FileMatchParams {

    /**
     * Glob to look for
     */
    glob: string;

    parseWith: FileParser;

    pathExpression: string;
}

/**
 * Check for presence of a match within the AST of files matching the glob.
 * Always return something, but may have an empty path.
 */
export function fileMatchAspect(config: Omit<Aspect, "stats" | "extract" | "apply"> &
    FileMatchParams): Aspect<FileMatchData> {
    return {
        toDisplayableFingerprintName: name => `File match '${config.glob}'`,
        toDisplayableFingerprint: fp =>
            fp.data.matches.length === 0 ?
                "None" :
                fp.data.matches
                    .map(m => m.matchValue)
                    .join(),
        stats: {
            defaultStatStatus: {
                entropy: false,
            },
        },
        ...config,
        extract:
            async p => {
                const matches: FileMatch[] = [];
                const it = fileHitIterator(p, {
                    parseWith: config.parseWith,
                    pathExpression: config.pathExpression,
                    globPatterns: config.glob,
                });
                for await (const match of it) {
                    matches.push({
                        filePath: match.file.path,
                        pathExpression: config.pathExpression,
                        matchValue: match.matches[0].$value,
                    });
                }
                const data = {
                    kind: FileMatchType as any,
                    matches,
                    glob: config.glob,
                };
                return {
                    type: config.name,
                    name: config.name,
                    data,
                    sha: sha256(JSON.stringify(data)),
                };
            },
    };
}
