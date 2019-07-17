import { Project, projectUtils, RepoRef } from "@atomist/automation-client";
import * as _ from "lodash";

export interface ExposedSecret {

    repoRef: RepoRef;

    /**
     * File path within project
     */
    path: string;

    secret: string;

    description: string;

    // TODO add source location extraction
}

/**
 * Definition of a secret we can find in a project
 */
export interface SecretDefinition {

    /**
     * Regexp for the secret
     */
    pattern: RegExp,

    /**
     * Description of the problem. For example, what kind of secret this is.
     */
    description: string;
}

export interface SnifferOptions {

    scanOnlyChangedFiles: boolean;

    globs: string[];

    secretDefinitions: SecretDefinition[];

    /**
     * Whitelisted secrets
     */
    whitelist: string[];
}

/**
 * Result of sniffing
 */
export interface SniffResult {
    options: SnifferOptions;
    exposedSecrets: ExposedSecret[];
    filesSniffed: number;
    timeMillis: number;
}

/**
 * Sniff this project for exposed secrets.
 * Open every file.
 */
export async function sniffProject(project: Project, options: SnifferOptions): Promise<SniffResult> {
    let filesSniffed = 0;
    const startTime = new Date().getTime();
    const exposedSecrets = _.flatten(await projectUtils.gatherFromFiles(project, options.globs, async f => {
        if (await f.isBinary()) {
            return undefined;
        }
        ++filesSniffed;
        return sniffFileContent(project.id, f.path, await f.getContent(), options);
    }));
    return {
        options,
        filesSniffed,
        exposedSecrets,
        timeMillis: new Date().getTime() - startTime,
    };
}

export async function sniffFileContent(repoRef: RepoRef, path: string, content: string, opts: SnifferOptions): Promise<ExposedSecret[]> {
    const exposedSecrets: ExposedSecret[] = [];
    for (const sd of opts.secretDefinitions) {
        const matches = content.match(sd.pattern) || [];
        matches
            .filter(m => !opts.whitelist.includes(m))
            .forEach(m => exposedSecrets.push(({
                repoRef,
                path,
                description: sd.description,
                secret: m,
            })));
    }
    return exposedSecrets;
}
