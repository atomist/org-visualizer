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

import { LocalProject } from "@atomist/automation-client";
import { ExtractFingerprint, Feature, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import * as child_process from "child_process";
import * as util from "util";

const exec = util.promisify(child_process.exec);

const gitLastCommitCommand = "git log -1 --format=%cd --date=short";

const gitRecencyExtractor: ExtractFingerprint =
    async p => {
        const r = await exec(gitLastCommitCommand, { cwd: (p as LocalProject).baseDir });
        if (!r.stdout) {
            return undefined;
        }
        const data = new Date(r.stdout.trim());

        return {
            type: "git-recency",
            name: "git-recency",
            data,
            sha: sha256(JSON.stringify(data)),
        };
    };

export const GitRecencyFeature: Feature = {
    name: "git-recency",
    displayName: undefined,
    extract: gitRecencyExtractor,
};

// export const gitActivityExtractor: ExtractFingerprint =
//     async p => {
//         // TODO make this reusable so we can see for default branch and all others
//         const r = await exec(sinceDays(7), { cwd: (p as LocalProject).baseDir });
//         if (!r.stdout) {
//             return undefined;
//         }
//         const last7 = parseInt(r.stdout.trim(), 10);
//
//         return {
//             type: "git-activity"
//             name: "gitActivity",
//             last7,
//         };
//     };

/**
 * Return a command
 * @param {number} days
 * @return {string}
 */
function sinceDays(days: number): string {
    return `git log --all --since=${days}.days --pretty=oneline | wc -l`;
}
