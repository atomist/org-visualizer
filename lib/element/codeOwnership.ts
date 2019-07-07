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
import { ExtractFingerprint, Feature, FP, sha256 } from "@atomist/sdm-pack-fingerprints";

export interface CodeOwnershipData {

    /**
     * Content of the CODEOWNERS
     */
    content: string;

    /**
     * JIRA team specified in a comment, if any
     */
    jiraTeam?: string;
}

const codeOwnershipFingerprintName = "codeOwnership";

/*
 * Find a code ownership file if possible
 */
export const CodeOwnershipExtractor: ExtractFingerprint =
    async (p: Project) => {
        const codeownersFile = await p.getFile("CODEOWNERS");
        if (codeownersFile) {
            const content = await codeownersFile.getContent();
            const jiraTeamMatch = /JiraTeam\((?<teamId>.*)\)/.exec(content);
            const jiraTeam = jiraTeamMatch ? jiraTeamMatch.groups.teamId : "No Jira Team";
            const data: CodeOwnershipData = {
                jiraTeam,
                content,
            };
            return {
                name: codeOwnershipFingerprintName,
                abbreviation: "owners",
                data,
                sha: sha256(JSON.stringify(data)),
            }
        }
        return undefined;
    };

export class CodeOwnershipFeature implements Feature {

    public readonly displayName: string = "Code Ownership";

    public readonly name: string = "codeOwnership";

    get apply() {
        return async (p, tsi) => {
            throw new Error(`Applying code ownership is not yet supported. But it could be.`);
        };
    }

    public selector = fp => fp.name === codeOwnershipFingerprintName;

    public extract = CodeOwnershipExtractor;

    public toDisplayableFingerprint(fp: FP): string {
        return fp.data;
    }
}
