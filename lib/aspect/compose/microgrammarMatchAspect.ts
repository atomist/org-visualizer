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

import { MicrogrammarBasedFileParser } from "@atomist/automation-client";
import { Grammar } from "@atomist/microgrammar";
import {
    Aspect,
    BaseAspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { Omit } from "../../util/omit";
import {
    fileMatchAspect,
    FileMatchData,
} from "./fileMatchAspect";

export interface MicrogrammarMatchParams<T> {

    /**
     * Glob to look for
     */
    glob: string;

    /**
     * Microgrammar to use
     */
    grammar: Grammar<T>;

    /**
     * Path within the microgrammar match to resolve. Property name.
     */
    path: keyof T;
}

/**
 * Check for matches of the given microgrammar with the
 */
export function microgrammarMatchAspect<T>(config: Omit<BaseAspect, "stats" | "apply"> &
    MicrogrammarMatchParams<T>): Aspect<FP<FileMatchData>> {
    return fileMatchAspect({
        ...config,
        parseWith: new MicrogrammarBasedFileParser("root", "matchName",
            config.grammar),
        pathExpression: `//matchName//${config.path}`,
    });
}
