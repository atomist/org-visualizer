import { Project, ProjectFile } from "@atomist/automation-client";

/**
 * Return the first file found of the given paths
 * @param {Project} p
 * @param {string} paths
 * @return {Promise<File | undefined>}
 */
export async function firstFileFound(p: Project, ...paths: string[]): Promise<ProjectFile | undefined> {
    for (const path of paths) {
        const f = await p.getFile(path);
        if (f) {
            return f;
        }
    }
    return undefined;
}
