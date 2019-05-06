import { TechnologyElement, TechnologyScanner } from "@atomist/sdm-pack-analysis";

/**
 * Information extracted from package-lock.json files.
 */
export interface PackageLock extends TechnologyElement {

    packageLock: {
        dependencies: Record<string, {
            version: string;
        }>,
    };

}

/**
 * Scan package lock files
 * @param {Project} p
 * @return {Promise<any>}
 */
export const packageLockScanner: TechnologyScanner<PackageLock> = async p => {
    const pl = await p.getFile("package-lock.json");
    if (!pl) {
        return undefined;
    }
    return {
        name: "packageLock",
        packageLock: JSON.parse(await pl.getContent()),
        tags: [],
    };
};
