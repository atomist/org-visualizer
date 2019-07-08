import { execPromise } from "@atomist/sdm";
import { ConcreteIdeal } from "@atomist/sdm-pack-fingerprints";
import {
    createNpmDepFingerprint,
    deconstructNpmDepsFingerprintName
} from "@atomist/sdm-pack-fingerprints/lib/fingerprints/npmDeps";
import { logger } from "@atomist/automation-client";

export async function idealsFromNpm(name: string): Promise<ConcreteIdeal[]> {
    const ideal = await idealFromNpm(name);
    return ideal ? [ideal] : [];
}

export async function idealFromNpm(name: string): Promise<ConcreteIdeal> {
    const libraryName = deconstructNpmDepsFingerprintName(name);
    try {
        const result = await execPromise("npm", ["view", libraryName, "dist-tags.latest"]);
        logger.info(`World Ideal Version is ${result.stdout} for ${libraryName}`);
        return {
            ideal: createNpmDepFingerprint(libraryName, result.stdout.trim()),
            reason: "latest from NPM",
        };
    } catch (err) {
        logger.error("Could not find version of " + libraryName + ": " + err.message);
    }
    return undefined;
}
