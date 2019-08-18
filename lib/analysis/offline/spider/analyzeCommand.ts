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

import { logger } from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    CommandListenerInvocation,
    ParametersObject,
} from "@atomist/sdm";
import {
    spider,
    SpiderAppOptions,
} from "./spiderCall";

interface AnalyzeCommandParameters {
    workspaceId: string;
    update: boolean;
}

const AnalyzeCommandParameterDefinitions: ParametersObject<AnalyzeCommandParameters> = {
    workspaceId: {
        description: "Atomist workspace ID to save analysis in. Defaults to 'local'",
        defaultValue: "local",
        required: false,
    },
    update: {
        type: "boolean",
        description: "Overwrite existing analyses? (default is no)",
        required: false,
    },
};

export interface AnalyzeGitHubCommandParameters extends AnalyzeCommandParameters {
    update: boolean;
    source: "GitHub";
    owner?: string;
    query?: string;
    search?: string;
    cloneUnder?: string;
}

const AnalyzeGitHubCommandParametersDefinition: ParametersObject<AnalyzeGitHubCommandParameters> = {
    ...AnalyzeCommandParameterDefinitions,
    source: {
        description: "find repositories on GitHub. Please specify at least 'owner' or 'query'",
        defaultValue: "GitHub",
        displayable: false,
        required: false,
        pattern: /GitHub/,
        validInput: "'GitHub'",
    },
    owner: {
        description: "GitHub owner of repositories to analyze",
        required: true,
    },
    query: {
        description: "A GitHub search query to choose repositories",
        required: true,
    },
    search: {
        description: "To narrow which repositories within an owner, provide a substring to look for in the repo name",
        required: false,
    },
    cloneUnder: {
        description: "A local directory to clone repositories in",
        required: false,
    },
};
export interface AnalyzeLocalCommandParameters extends AnalyzeCommandParameters {
    update: boolean;
    source: "local";
    localDirectory: string;
}

const AnalyzeLocalCommandParametersDefinition: ParametersObject<AnalyzeLocalCommandParameters> = {
    ...AnalyzeCommandParameterDefinitions,
    source: {
        description: "find repositories on the local filesystem",
        defaultValue: "local",
        displayable: false,
        required: false,
        pattern: /local/,
        validInput: "'local'",
    },
    localDirectory: {
        description: "absolute path to find repositories in",
        required: true,
    },
};

const analyzeFromGitHub =
    async (d: CommandListenerInvocation<AnalyzeGitHubCommandParameters>) => {
        const { owner, query } = d.parameters;
        if (!owner && !query) {
            await d.addressChannels("Please provide either 'owner' or 'query'");
            return { code: 1 };
        }
        const spiderAppOptions: SpiderAppOptions = d.parameters;
        logger.info("analyze github invoked with " + JSON.stringify(spiderAppOptions));

        const result = await spider(spiderAppOptions);
        await d.addressChannels(`Analysis result: `
            + JSON.stringify(result, undefined, 2));
        return { code: 0 };
    };

export const AnalyzeGitHubCommandRegistration: CommandHandlerRegistration<AnalyzeGitHubCommandParameters> = {
    name: "analyzeRepositoriesFromGitHub",
    intent: ["analyze github repositories"],
    description: "choose repositories to analyze, by owner or query",
    parameters: AnalyzeGitHubCommandParametersDefinition,
    listener: analyzeFromGitHub,
};

const analyzeFromLocal =
    async (d: CommandListenerInvocation<AnalyzeLocalCommandParameters>) => {
        const spiderAppOptions: SpiderAppOptions = d.parameters;
        logger.info("analyze local invoked with " + JSON.stringify(spiderAppOptions));

        const result = await spider(spiderAppOptions);
        await d.addressChannels(`Analysis result: `
            + JSON.stringify(result, undefined, 2));
        return { code: 0 };
    };

export const AnalyzeLocalCommandRegistration: CommandHandlerRegistration<AnalyzeLocalCommandParameters> = {
    name: "analyzeRepositoriesFromLocalFilesystem",
    intent: ["analyze local repositories"],
    description: "choose repositories to analyze, by parent directory",
    parameters: AnalyzeLocalCommandParametersDefinition,
    listener: analyzeFromLocal,
};
