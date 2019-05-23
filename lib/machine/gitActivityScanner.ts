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
import { spawnPromise } from "@atomist/sdm";
import * as util from "util";

const exec = util.promisify(require('child_process').exec);

export interface GitActivity extends TechnologyElement {

    name: "gitActivity";
    last7: number;
}

export const GitActivityScanner: TechnologyScanner<GitActivity> =
    async p => {
    // TODO make this reusable so we can see for default branch and all others
        const r = await exec(sinceDays(7), { cwd: (p as any).baseDir });
        if (!r.stdout) {
            return undefined;
        }
        const last7 = parseInt(r.stdout.trim());

        return {
            tags: ["git"],
            name: "gitActivity",
            last7,
        }
    };

function sinceDays(days: number): string {
    return `git log --all --since=${days}.days --pretty=oneline | wc -l`;
}