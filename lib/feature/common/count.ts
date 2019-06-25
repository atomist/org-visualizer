import { LocalProject } from "@atomist/automation-client";
import { execPromise } from "@atomist/sdm";
import { Feature, sha256 } from "@atomist/sdm-pack-fingerprints";

/**
 * Size in terms of files
 */
export const fileCountFeature: Feature = {
    name: "size",
    // Display name is undefined to prevent display
    displayName: undefined,
    extract: async p => {
        const data = await p.totalFileCount() + "";
        return {
            name: "size",
            data,
            sha: sha256(data),
        };
    },
    toDisplayableFingerprint: fp => fp.data,
    toDisplayableFingerprintName: () => "size",
    selector: fp => fp.name === "size",
};

export const branchCount: Feature = {
    name: "branches",
    displayName: undefined,
    extract: async p => {
        const lp = p as LocalProject;
        const bp = await execPromise("git", ["branch", "-a"], {
            cwd: lp.baseDir,
        });
        const branchCount = bp.stdout.split("\n").length;
        const data = branchCount + "";
        return {
            name: "branches",
            data,
            sha: sha256(data),
        };
    },
    toDisplayableFingerprint: fp => fp.data,
    toDisplayableFingerprintName: () => "size",
    selector: fp => fp.name === "size",
};
