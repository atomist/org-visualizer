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

import { CountAspect, CountData } from "@atomist/sdm-pack-aspect/lib/aspect/compose/commonTypes";
import * as Octokit from "@octokit/rest";
import { fingerprintOf, FP } from "@atomist/sdm-pack-fingerprints";
import { logger } from "@atomist/automation-client";

export const GitHubType = "github";

export function githubAspect(token: string): CountAspect {
    const octokit = new Octokit({
        auth: token ? "token " + token : undefined,
        baseUrl: "https://api.github.com",
    });

    return {
        name: GitHubType,
        displayName: "github info",
        extract: async p => {
            const type = GitHubType;
            const fingerprints: Array<FP<CountData>> = [];
            logger.info("Making GitHub call for information about repo %s: GitHub token supplied: %s",
                p.id.url, !!token);
            const remote = await octokit.repos.get({ owner: p.id.owner, repo: p.id.repo});
            const stars = remote.data.stargazers_count;
            fingerprints.push(fingerprintOf({ type, name: "stars", data: { count: stars } }));
            const watchers = remote.data.watchers_count;
            fingerprints.push(fingerprintOf({ type, name: "watches", data: { count: watchers } }));
            const forks = remote.data.forks_count;
            fingerprints.push(fingerprintOf({ type, name: "forks", data: { count: forks } }));
            const issues = remote.data.open_issues_count;
            fingerprints.push(fingerprintOf({ type, name: "issues", data: { count: issues } }));
            return fingerprints;
        },
        stats: {
            defaultStatStatus: {
                entropy: false,
            },
            basicStatsPath: "count",
        },
    }

}
