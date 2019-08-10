import { FP } from "@atomist/sdm-pack-fingerprints";

/**
 * Flag for an undesirable usage
 */
export interface ProblemUsage {

    readonly severity: "info" | "warn" | "error";

    /**
     * Authority this comes from
     */
    readonly authority: string;

    /**
     * Message to the user
     */
    readonly description?: string;

    /**
     * URL associated with this if one is available.
     * For example, a security advisory.
     */
    readonly url?: string;

    readonly fingerprint: FP;
}

/**
 * Store of problem fingerprints
 */
export interface ProblemStore {

    noteProblem(workspaceId: string, fingerprintId: string): Promise<void>;

    storeProblemFingerprint(workspaceId: string, problem: ProblemUsage): Promise<void>;

    loadProblems(workspaceId: string): Promise<ProblemUsage[]>;

}

export type UndesirableUsageCheck = (workspaceId: string, fp: FP) => Promise<ProblemUsage | undefined>;

/**
 * Function that can flag an issue with a fingerprint.
 * This is a programmatic complement to ProblemStore.
 */
export interface UndesirableUsageChecker {
    check: UndesirableUsageCheck;
}

export const PermitAllUsageChecker: UndesirableUsageChecker = {
    check: async () => undefined,
};

/**
 * UndesirableUsageChecker from a list
 * @param {(fp: FP) => Promise<Flag[]>} checkers
 * @return {UndesirableUsageChecker}
 */
export function chainUndesirableUsageCheckers(...checkers: UndesirableUsageCheck[]): UndesirableUsageChecker {
    return {
        check: async (workspaceId, fp) => {
            for (const f of checkers) {
                const flagged = await f(workspaceId, fp);
                if (flagged) {
                    return flagged;
                }
            }
            return undefined;
        },
    };
}

/**
 * Undesirable usageChecker backed by a ProblemStore
 * @param {ProblemStore} problemStore
 * @param {string} workspaceId
 * @return {Promise<UndesirableUsageChecker>}
 */
export async function problemStoreBackedUndesirableUsageCheckerFor(problemStore: ProblemStore,
                                                                   workspaceId: string): Promise<UndesirableUsageChecker> {
    const problems: ProblemUsage[] = await problemStore.loadProblems(workspaceId);
    return {
        check: async (wsid, fp) => {
            return problems.find(p => p.fingerprint.sha === fp.sha);
        },
    };
}
