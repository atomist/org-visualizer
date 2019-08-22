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
    GraphQL,
    Success,
} from "@atomist/automation-client";
import { EventHandlerRegistration } from "@atomist/sdm";
import { fromName } from "@atomist/sdm-pack-fingerprints/lib/adhoc/preferences";
import {
    ApplyPolicyState,
    PolicyLog,
    sendPolicyLog,
} from "@atomist/sdm-pack-fingerprints/lib/log/policyLog";
import {
    OnPullRequest,
    PullRequestAction,
} from "../typings/types";

export const CreatePolicyLogOnPullRequest: EventHandlerRegistration<OnPullRequest.Subscription> = {
    name: "OnPullRequest",
    description: "Create PolicyLog on PullRequest activity",
    subscription: GraphQL.subscription("OnPullRequest"),
    listener: async (e, ctx) => {
        const pr = e.data.PullRequest[0];
        if (pr.action === PullRequestAction.opened || pr.action === PullRequestAction.closed) {
            const tagRegex = /\[fingerprint:([-\w:\/]+)=([-\w]+)\]/g;
            let tagMatches = tagRegex.exec(pr.body);
            const tags = [];
            while (!!tagMatches) {
                tags.push(tagMatches);
                tagMatches = tagRegex.exec(pr.body);
            }

            for (const tag of tags) {
                const { type, name } = fromName(tag[1]);

                const log: PolicyLog = {
                    type,
                    name,
                    apply: {
                        _sha: pr.head.sha,
                        _prId: pr.id,
                        branch: pr.branchName,
                        state: ApplyPolicyState.Success,
                        targetSha: tag[2],
                    },
                };
                await sendPolicyLog(log, ctx);
            }
        }
        return Success;
    },
};
