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
    buttonForCommand,
    GitProject,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    PushImpactListenerInvocation,
    SdmContext,
    slackQuestionMessage,
} from "@atomist/sdm";
import {
    Aspect,
    fingerprintOf,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { AddFingerprints } from "@atomist/sdm-pack-fingerprints/lib/typings/types";

export interface SuggestTagData {

    readonly tag: string;

    readonly reason: string;
}

export interface TagSuggester extends SuggestTagData {
    test(pli: PushImpactListenerInvocation): Promise<boolean>;
}

const SuggestTagType = "suggest-tag";

/**
 * Add a test to see whether we should suggest a tag to be
 * confirmed by humans via chat.
 */
export function suggestTag(suggester: TagSuggester): Aspect<SuggestTagData> {
    return {
        name: SuggestTagType,
        displayName: `Suggest tag ${suggestTag.name}`,
        extract: async (p, pli) => {
            const pili = {
                ...pli,
                project: p as GitProject,
            };
            const suggestion = await suggester.test(pili);
            return suggestion ?
                fingerprintOf({
                    type: SuggestTagType,
                    name: suggestTag.name,
                    data: {
                        tag: suggester.tag,
                        reason: suggester.reason,
                    },
                }) :
                undefined;
        },
        toDisplayableFingerprint: fp => fp.data.tag,
        workflows: [
            async (pli, diffs) => {
                if (diffs.length > 0) {
                    if (diffs.map(d => d.to).some(to => to.data.tag)) {
                        const askAboutTagging = slackQuestionMessage(
                            "Tag?",
                            `This commit looks like it should be tagged with \`${suggester.tag}\`, because\n_${suggester.reason}_`,
                            {
                                actions: [buttonForCommand({ text: `Tag with ${suggester.tag}` },
                                    "set-fingerprint",
                                    {
                                        repoId: pli.push.repo[0].id,
                                        branchId: pli.push.branch[0],
                                        sha: pli.push.after.sha,
                                        tag: suggester.tag,
                                        reason: suggester.reason,
                                    },
                                )],
                            });
                        await pli.addressChannels(askAboutTagging);
                    }
                }
                return [{ abstain: true }];
            },
        ],
    };
}

export interface IdRepo {
    branchId: string;
    repoId: string;
    sha: string;
}

export type AddFingerprint = (ctx: SdmContext, repo: IdRepo, fp: FP) => Promise<void>;

const addFingerprintToGraph: AddFingerprint = async (ctx, repo, fp) => {
    await ctx.context.graphClient.mutate<AddFingerprints.Mutation, AddFingerprints.Variables>(
        {
            name: "AddFingerprints",
            variables: {
                additions: [fp],
                isDefaultBranch: true,
                type: fp.type,
                ...repo,
            },
        },
    );
};

/**
 * Type of a confirmed tag fingerprint
 * @type {string}
 */
export const ConfirmedTagType = "confirmed-tag";

export function addFingerprintCommand(adder: AddFingerprint = addFingerprintToGraph): CommandHandlerRegistration<{
    sha: string, tag: string, reason: string,
} & IdRepo> {
    return {
        name: "set-fingerprint",
        parameters: {
            sha: {},
            tag: {},
            reason: {},
            repoId: {},
            branchId: {},
        },
        listener: async ci => {
            const fp = fingerprintOf({
                type: ConfirmedTagType,
                name: ci.parameters.tag,
                data: {
                    reason: ci.parameters.reason,
                },
            });
            await adder(ci, ci.parameters, fp);
        },
    };
}
