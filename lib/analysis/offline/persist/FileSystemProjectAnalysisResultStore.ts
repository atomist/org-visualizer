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
    RepoId,
} from "@atomist/automation-client";
import * as fs from "fs";
import * as path from "path";
import {
    isProjectAnalysisResult,
    ProjectAnalysisResult,
} from "../../ProjectAnalysisResult";
import { ProjectAnalysisResultStore } from "./ProjectAnalysisResultStore";

import * as appRoot from "app-root-path";

/**
 * Store files under the /spidered directory of current project unless otherwise specified
 */
export class FileSystemProjectAnalysisResultStore implements ProjectAnalysisResultStore {

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
        return (await this.loadAll()).length;
    }

    public async persist(what: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<number> {
        const repos = isProjectAnalysisResult(what) ? [what] : what;
        let persisted = 0;
        for await (const repo of repos) {
            const filePath = this.toFilePath(repo.analysis.id);
            try {
                const json = JSON.stringify(repo, undefined, 2);
                fs.writeFileSync(filePath, json);
                logger.info(`Persisted to ${filePath}`);
                ++persisted;
            } catch (err) {
                logger.error("Cannot persist file to %s: %s", filePath, err.message);
            }
        }
        return persisted;
    }

    public async load(repo: RepoId): Promise<ProjectAnalysisResult> {
        try {
            const raw = fs.readFileSync(this.toFilePath(repo)).toString();
            const r = JSON.parse(raw) as ProjectAnalysisResult;
            return r;
        } catch (err) {
            logger.error("Cannot loadAll file from %s: %s", this.toFilePath(repo), err.message);
            return undefined;
        }
    }

    public async loadAll(): Promise<ProjectAnalysisResult[]> {
        const files = fs.readdirSync(this.path);
        const results: ProjectAnalysisResult[] = [];
        for (const file of files) {
            const filePath = path.join(this.path, file);
            try {
                const raw = fs.readFileSync(filePath).toString();
                const ar = JSON.parse(raw);
                results.push(ar);
            } catch (err) {
                logger.warn("Badly formed JSON in %s: %s", filePath, err.message);
            }
        }
        return results;
    }

    private toFilePath(repo: RepoId): string {
        return `${this.path}/${repo.owner}:${repo.repo}.json`;
    }

}
