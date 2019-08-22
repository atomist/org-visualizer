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
