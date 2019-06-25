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
import { AbstractFingerprint } from "@atomist/sdm";
import {
    AnalysisDerivedFeature,
    ProjectAnalysis,
    TechnologyElement,
    TechnologyScanner,
} from "@atomist/sdm-pack-analysis";
import { PossibleIdeal } from "@atomist/sdm-pack-fingerprints";

export interface CodeOwnershipElement extends TechnologyElement {

    /**
     * Content of the CODEOWNERS
     */
    content: string;

    /**
     * JIRA team specified in a comment, if any
     */
    jiraTeam?: string;
}

/*
 * Find a code of conduct in a repository if possible
 */
export const CodeOwnerScanner: TechnologyScanner<CodeOwnershipElement> =
    async (p: Project) => {
        const codeownersFile = await p.getFile("CODEOWNERS");
        if (codeownersFile) {
            const content = await codeownersFile.getContent();
            const jiraTeamMatch = /JiraTeam\((?<teamId>.*)\)/.exec(content);
            const jiraTeam = jiraTeamMatch ? jiraTeamMatch.groups.teamId : "No Jira Team";
            return {
                name: "codeOwnership",
                tags: ["ownership"],
                jiraTeam,
                content,
            };
        }
        return undefined;
    };

const codeOwnershipFingerprintName = "codeOwnership";
export class CodeOwnership extends AbstractFingerprint {
    constructor(public readonly codeOwnershipContent: string) {
        super(codeOwnershipFingerprintName, "owners", "1.0.0", codeOwnershipContent);
    }

}
export class CodeOwnershipFeature implements AnalysisDerivedFeature<CodeOwnership> {

    public readonly displayName: string = "Code Ownership";

    public readonly name: string = "codeOwnership";

    get apply() {
        return async (p, tsi) => {
            throw new Error(`Applying code ownership is not yet supported. But it could be.`);
        };
    }

    public selector = fp => fp.name === codeOwnershipFingerprintName;

    public async derive(analysis: ProjectAnalysis) {
        const n = analysis.elements.codeOwnership as CodeOwnershipElement;
        if (!n) {
            return undefined;
        }
        return !!n.jiraTeam ?
            new CodeOwnership(n.jiraTeam) :
            undefined;
    }

    public get relevanceTest() {
        return pa => !!pa.elements.codeOwnership;
    }

    public get necessityTest() {
        return pa => !!pa.elements.codeOwnership;
    }

    public toDisplayableString(h: CodeOwnership): string {
        return h.data;
    }

    public async suggestedIdeals(fingerprintName: string): Promise<Array<PossibleIdeal<CodeOwnership>>> {
        return [];
    }

}
