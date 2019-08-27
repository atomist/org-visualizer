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
    logger,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    PushImpactListenerInvocation,
    slackQuestionMessage,
} from "@atomist/sdm";
import {
    Aspect,
    fingerprintOf,
    PublishFingerprintsFor,
    RepoIdentification,
    sendFingerprintsToAtomistFor,
} from "@atomist/sdm-pack-fingerprints";

export interface SuggestTagData {

    readonly tag: string;

    readonly reason: string;
}

export interface TagSuggester extends SuggestTagData {
    test(pli: PushImpactListenerInvocation): Promise<boolean>;
}

const SuggestTagType = "suggest-tag";

const SetFingerprintCommandName = "set-fingerprint";

type RepoTaggingParams = {
    url: string,
} & RepoIdentification & SuggestTagData;

/**
 * Add a test to see whether we should suggest a tag to be
 * confirmed by humans via chat.
 * Only works if suggestTagCommand is added to the SDM.
 */
export function suggestTag(suggester: TagSuggester): Aspect<SuggestTagData> {
    return {
        name: SuggestTagType,
        // Suppress display
        displayName: undefined,
        extract: async () => [],
        consolidate: async (fingerprints, p, pli) => {
            const pili = {
                ...pli,
                project: p as GitProject,
            };
            const suggestion = await suggester.test(pili);
            return suggestion ?
                [fingerprintOf({
                    type: SuggestTagType,
                    name: suggestTag.name,
                    data: {
                        tag: suggester.tag,
                        reason: suggester.reason,
                    },
                })] :
                [];
        },
        toDisplayableFingerprint: fp => fp.data.tag,
        workflows: [
            async (pli, diffs) => {
                if (diffs.length > 0) {
                    if (diffs.map(d => d.to).some(to => to.data.tag)) {
                        const parameters: RepoTaggingParams = {
                            owner: pli.id.owner,
                            repo: pli.id.repo,
                            branch: pli.push.branch,
                            sha: pli.push.after.sha,
                            url: pli.id.url,
                            tag: suggester.tag,
                            reason: suggester.reason,
                        };
                        logger.info("Creating button for command %s with parameters: %j", SetFingerprintCommandName, parameters);
                        const askAboutTagging = slackQuestionMessage(
                            "Tag?",
                            `This commit looks like it should be tagged with \`${suggester.tag}\`, because\n_${suggester.reason}_`,
                            {
                                actions: [
                                    buttonForCommand({ text: `Tag with ${suggester.tag}` },
                                        SetFingerprintCommandName,
                                        parameters,
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

/**
 * Type of a confirmed tag fingerprint
 * @type {string}
 */
export const ConfirmedTagType = "confirmed-tag";

/**
 * Provides Aspect metadata for ConfirmedTag
 */
export const ConfirmedTags: Aspect<SuggestTagData> = {
    name: ConfirmedTagType,
    displayName: "Human confirmed tag",

    /**
     * No extract method. Will be set via a addSuggestedFingerprintCommand
     * @return {Promise<any[]>}
     */
    extract: async () => [],
    toDisplayableFingerprint: fp => `${fp.data.tag} because ${fp.data.reason}`,
};

/**
 * Add a fingerprint to the repo
 * @param {PublishFingerprintsFor} publisher
 * @return {CommandHandlerRegistration<RepoTaggingParams>}
 */
export function addSuggestedFingerprintCommand(
    publisher: PublishFingerprintsFor = sendFingerprintsToAtomistFor): CommandHandlerRegistration<RepoTaggingParams> {
    return {
        name: SetFingerprintCommandName,
        parameters: {
            owner: {},
            repo: {},
            branch: {},
            sha: {},
            tag: {},
            reason: {},
            url: {},
        },
        listener: async ci => {
            const fp = fingerprintOf<SuggestTagData>({
                type: ConfirmedTagType,
                name: ci.parameters.tag,
                data: {
                    tag: ci.parameters.tag,
                    reason: ci.parameters.reason,
                },
            });
            logger.info("Publishing fingerprint %j against %j", fp, ci.parameters);
            await publisher(ci, ci.parameters, [fp], {});
        },
    };
}
