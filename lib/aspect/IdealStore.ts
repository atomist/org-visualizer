import { Ideal } from "@atomist/sdm-pack-fingerprints";

/**
 * Function that can return the desired ideal, if any, for a given fingerprint name.
 * While an Aspect can suggest multiple ideals in the suggestedIdeals method,
 * there can only be one ideal recommended at any time.
 */
export interface IdealStore {

    storeIdeal(workspaceId: string, ideal: Ideal): Promise<void>;

    /**
     * Set the ideal to the given fingerprint id
     * @param {string} workspaceId
     * @param {string} fingerprintId
     * @return {Promise<void>}
     */
    setIdeal(workspaceId: string, fingerprintId: string): Promise<void>;

    loadIdeal(workspaceId: string, type: string, name: string): Promise<Ideal | undefined>;

    /**
     * Load all ideals in this workspace
     * @param {string} workspaceId
     * @return {Promise<Ideal[]>}
     */
    loadIdeals(workspaceId: string): Promise<Ideal[]>;

}
