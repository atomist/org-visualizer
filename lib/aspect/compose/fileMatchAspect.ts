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

import { Aspect, BaseAspect, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { Omit } from "../../util/omit";
import { FileParser, MicrogrammarBasedFileParser } from "@atomist/automation-client";
import { Grammar } from "@atomist/microgrammar";
import { fileHitIterator, findFileMatches } from "@atomist/automation-client/lib/tree/ast/astUtils";

export interface FileMatch {
    filePath: string;
    pathExpression: string;
    matchValue: string;
}

export interface FileMatchData {
    matches: FileMatch[];
}

export const FileMatchType = "file-match";

/**
 * Check for presence of a match within a single file
 * undefined to return no fingerprint.
 * Always return something, but may have an empty path.
 */
export function fileMatchAspect(config: Omit<BaseAspect, "stats" | "apply"> &
    {
        globs: string,
        parseWith: FileParser,
        pathExpression: string,
    }): Aspect<FP<FileMatchData>> {
    return {
        toDisplayableFingerprintName: name => `File match '${config.globs}'`,
        toDisplayableFingerprint: fp => JSON.stringify(fp.data),
        ...config,
        extract: async p => {
            const matches: FileMatch[] = [];
            const it = fileHitIterator(p, {
                parseWith: config.parseWith,
                pathExpression: config.pathExpression,
                globPatterns: config.globs,
            });
            for await (const match of it) {
                matches.push({
                    filePath: match.file.path,
                    pathExpression: config.pathExpression,
                    matchValue: match.matches[0].$value,
                });
            }
            const data = { matches };
            return {
                name: config.name,
                type: FileMatchType,
                data,
                sha: sha256(JSON.stringify(data)),
            };
        },
    };
}

export function microgrammarMatchAspect<T>(config: Omit<BaseAspect, "stats" | "apply"> &
    {
        globs: string,
        grammar: Grammar<T>,
        path: keyof T,
    }): Aspect<FP<FileMatchData>> {
    return fileMatchAspect({
        ...config,
        parseWith: new MicrogrammarBasedFileParser("root", "matchName",
            config.grammar),
        pathExpression: `//matchName//${config.path}`,
    });
}