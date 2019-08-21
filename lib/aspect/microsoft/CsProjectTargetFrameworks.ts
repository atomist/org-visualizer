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

import { microgrammar } from "@atomist/microgrammar";
import {
    Aspect,
} from "@atomist/sdm-pack-fingerprints";
import {
    FileMatchData,
} from "../compose/fileMatchAspect";
import { microgrammarMatchAspect } from "../compose/microgrammarMatchAspect";

const targetFrameworksGrammar = microgrammar({
    _open: /<TargetFrameworks?>/,
    targetFramework: /[a-zA-Z0-9_;/.]+/,
    _close: /<\/TargetFrameworks?>/,
});

/**
 * TargetFramework
 * @type {Aspect<FP<FileMatchData>>}
 */
export const CsProjectTargetFrameworks: Aspect<FileMatchData> =
    microgrammarMatchAspect({
        name: "csproject-targetframeworks",
        displayName: "CSProject TargetFrameworks",
        glob: "*.csproj",
        grammar: targetFrameworksGrammar,
        path: "targetFramework",
        toDisplayableFingerprint: fp => fp.data.matches.length === 0 ? "None" : fp.data.matches[0].matchValue,
    });
