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
    LocalProject,
    logger,
} from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import {
    Aspect,
    sha256,
} from "@atomist/sdm-pack-fingerprints";

const BranchCountType = "branch-count";

export const branchCount: Aspect = {
    name: BranchCountType,
    displayName: "Branch count",
    extract: async p => {
        const lp = p as LocalProject;
        const commandResult = await execPromise(
            "git", ["branch", "--list", "-r", "origin/*"],
            {
                cwd: lp.baseDir,
            });
        const count = commandResult.stdout
            .split("\n")
            .filter(l => !l.includes("origin/HEAD")).length - 1;
        const data = { count };
        logger.info("Branch count for %s is %d", p.id.url, count);
        return {
            type: BranchCountType,
            name: BranchCountType,
            data,
            sha: sha256(JSON.stringify(data)),
        };
    },
    toDisplayableFingerprintName: () => "branch count",
    toDisplayableFingerprint: fp => {
        const count = parseInt(fp.data.count, 10);
        if (count > 20) {
            return "crazy (>20)";
        }
        if (count > 12) {
            return "excessive (12-20)";
        }
        if (count > 5) {
            return "high (5-12)";
        }
        return "ok (<=5)";
    },
    stats: {
        defaultStatStatus: {
            entropy: false,
        },
    },
};
