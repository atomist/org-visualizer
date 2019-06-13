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

import { RepoId } from "@atomist/automation-client";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { Client } from "pg";
import {
    isProjectAnalysisResult,
    ProjectAnalysisResult,
} from "../../ProjectAnalysisResult";
import { SpideredRepo } from "../SpideredRepo";
import {
    PersistResult,
    ProjectAnalysisResultStore,
} from "./ProjectAnalysisResultStore";

export class PostgresProjectAnalysisResultStore implements ProjectAnalysisResultStore {

    public count(): Promise<number> {
        return doWithClient(this.clientFactory, async client => {
            const rows = await client.query("SELECT COUNT(1) as c from repo_snapshots");
            return rows[0].c;
        });
    }

    public loadWhere(where: string): Promise<ProjectAnalysisResult[]> {
        return doWithClient(this.clientFactory, async client => {
            const sql = `SELECT owner, name, url, commit_sha, analysis, timestamp 
                from repo_snapshots ` +
                (where ? `WHERE ${where}` : "");
            const rows = await client.query(sql);
            // TODO workspace ID
            return rows.rows;
        });
    }

    // TODO also sha
    public async loadOne(repo: RepoId): Promise<ProjectAnalysisResult> {
        return doWithClient(this.clientFactory, async client => {
            const result = await client.query(`SELECT (
                owner, name, url, commit_sha, analysis, timestamp) from repo_snapshots
                WHERE owner = $1 AND name = $2`, [repo.owner, repo.repo]);
            return result.rows.length >= 1 ? {
                analysis: result.rows[0].analysis,
                timestamp: result.rows[0].timestamp,
                workspaceId: result.rows[0].workspace_id,
            } : undefined;
        });
    }

    public async persist(repos: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult> {
        const persisted = await this.persistAnalysisResults(isProjectAnalysisResult(repos) ? [repos] : repos);
        return {
            // TODO fix this
            succeeded: [],
            failed: [],
            attemptedCount: persisted,
        };
    }

    private async persistAnalysisResults(results: AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<number> {
        return doWithClient(this.clientFactory, async client => {
            let persisted = 0;
            for await (const result of results) {
                const repoRef = result.analysis.id;
                if (!repoRef.url) {
                    console.log("Ignoring repo w/o url: " + repoRef.repo);
                    continue;
                }
                const ret = await client.query(`
            INSERT INTO repo_snapshots (workspace_id, provider_id, owner, name, url, commit_sha, analysis, timestamp, query)
VALUES ($7, $3, $1, $2, $3, $4, $5, current_timestamp, $6) RETURNING id`,
                    [repoRef.owner, repoRef.repo, repoRef.url,
                        !!result.analysis.gitStatus ? result.analysis.gitStatus.sha : undefined,
                        result.analysis, (result as SpideredRepo).query,
                        result.workspaceId,
                    ]);
                const id = ret.rows[0].id;
                await this.persistFingerprints(result.analysis, id, client);
                ++persisted;
            }
            return persisted;
        });
    }

    // Persist the fingerprints for this analysis
    private async persistFingerprints(pa: ProjectAnalysis, id: number, client: Client): Promise<void> {
        // Whack any joins
        await client.query(`DELETE from repo_fingerprints WHERE repo_snapshot_id = $1`, [id]);

        for (const fp of pa.fingerprints) {
            const featureName = fp.type || "unknown";

            console.log("Persist fingerprint " + JSON.stringify(fp) + " for id " + id);
            // Create fp record if it doesn't exist
            await client.query(`INSERT INTO fingerprints (name, feature_name, sha, data)
values ($1, $2, $3, $4) ON CONFLICT DO NOTHING
`, [fp.name, featureName, fp.sha, JSON.stringify(fp.data)]);
            await client.query(`INSERT INTO repo_fingerprints (repo_snapshot_id, name, feature_name, sha)
values ($1, $2, $3, $4) ON CONFLICT DO NOTHING
`, [id, fp.name, featureName, fp.sha]);
        }
    }

    constructor(public readonly clientFactory: ClientFactory) {
    }

}

export interface ClientOptions {
    user?: string;
    password?: string;
    database?: string;
    port?: number;
    host?: string;
}

export type ClientFactory = () => Client;

export async function doWithClient<R>(clientFactory: () => Client,
                                      what: (c: Client) => Promise<R>): Promise<R> {
    const client = clientFactory();
    let result: R;
    await client.connect();
    try {
        result = await what(client);
    } catch (err) {
        console.log(err);
    } finally {
        client.end();
    }
    return result;
}
