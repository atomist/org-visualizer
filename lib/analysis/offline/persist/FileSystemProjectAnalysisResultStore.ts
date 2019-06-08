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
    logger,
    RepoRef,
} from "@atomist/automation-client";
import * as fs from "fs";
import * as path from "path";
import {
    isProjectAnalysisResult,
    ProjectAnalysisResult,
} from "../../ProjectAnalysisResult";
import {
    PersistResult,
    ProjectAnalysisResultStore,
    ProjectUrl,
} from "./ProjectAnalysisResultStore";

import * as appRoot from "app-root-path";

const readdir = require("recursive-readdir");
import * as fse from "fs-extra";
import {
    PersistenceResult,
    SpiderFailure,
} from "../spider/Spider";

/**
 * Store files under the /spidered directory of current project unless otherwise specified
 */
export class FileSystemProjectAnalysisResultStore implements ProjectAnalysisResultStore {

    /**
     * Base path
     */
    public readonly path: string;

    constructor(userPath?: string) {
        if (!!userPath) {
            this.path = userPath;
        } else {
            const defaultPath = path.join(appRoot.toString(), "spidered");
            this.path = defaultPath;
        }
        if (!fs.existsSync(this.path)) {
            logger.info("Creating directory '%s' to store analyses...", path);
            fs.mkdirSync(this.path);
        }
    }

    public async count(): Promise<number> {
        return (await this.loadWhere()).length;
    }

    public async persist(what: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult> {
        const repos = isProjectAnalysisResult(what) ? [what] : what;
        let persisted = 0;
        const written: PersistenceResult[] = [];
        const errors: SpiderFailure[] = [];
        for await (const repo of repos) {
            const filePath = this.toFilePath(repo.analysis.id);
            try {
                const json = JSON.stringify(repo, undefined, 2);
                fse.outputFileSync(filePath, json);
                logger.info(`Persisted to ${filePath}`);
                ++persisted;
                written.push(filePath);
            } catch (err) {
                errors.push({ repoUrl: repo.analysis.id.url, whileTryingTo: "persist", message: err.message });
                logger.error("Cannot persist file to %s: %s", filePath, err.message);
            }
        }
        return { attemptedCount: persisted, failed: errors, succeeded: written };
    }

    public async loadOne(repo: RepoRef): Promise<ProjectAnalysisResult | undefined> {
        const filepath = this.toFilePath(repo);
        if (!fs.existsSync(filepath)) {
            logger.info("No persisted file found for %s", filepath);
            return undefined;
        }
        try {
            const raw = fs.readFileSync(filepath).toString();
            const r = JSON.parse(raw) as ProjectAnalysisResult;
            return r;
        } catch (err) {
            logger.error("Cannot load file from %s: %s", filepath, err.message);
            return undefined;
        }
    }

    public async loadWhere(): Promise<ProjectAnalysisResult[]> {
        const filePaths = await readdir(this.path);
        const results: ProjectAnalysisResult[] = [];
        for (const filePath of filePaths) {
            try {
                const raw = fs.readFileSync(filePath).toString();
                const ar = JSON.parse(raw);
                results.push(ar);
            } catch (err) {
                logger.warn("Badly formed JSON in '%s': %s", filePath, err.message);
            }
        }
        return results;
    }

    private toFilePath(repo: RepoRef): string {
        const base = path.join(this.path, repo.owner, repo.repo, repo.path || "");
        // if (!!repo.path) {
        //     base += "::" + path;
        // }
        const absPath = base + ".json";
        console.log(`Absolute path='${absPath}'`);
        return absPath;
    }

}
