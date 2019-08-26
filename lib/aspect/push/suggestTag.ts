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

import { buttonForCommand, GitProject } from "@atomist/automation-client";
import { PushImpactListenerInvocation, slackQuestionMessage } from "@atomist/sdm";
import { Aspect, fingerprintOf } from "@atomist/sdm-pack-fingerprints";

export interface SuggestTagData {

    /**
     * Score out of five
     */
    tag: string;

    reason: string;
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
                                    { sha: pli.push.after.sha, tag: suggester.tag, reason: suggester.reason },
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
