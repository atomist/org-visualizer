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
    combinePersistResults,
    emptyPersistResult,
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
            const result = await client.query(`SELECT owner, name, url, commit_sha, analysis, timestamp
                FROM repo_snapshots
                WHERE owner = $1 AND name = $2`, [repo.owner, repo.repo]);
            return result.rows.length >= 1 ? {
                analysis: result.rows[0].analysis,
                timestamp: result.rows[0].timestamp,
                workspaceId: result.rows[0].workspace_id,
            } : undefined;
        });
    }

    public async persist(repos: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult> {
        return this.persistAnalysisResults(isProjectAnalysisResult(repos) ? [repos] : repos);
    }

    private async persistAnalysisResults(
        analysisResultIterator: AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<PersistResult> {
        const persistResults: PersistResult[] = [];
        return doWithClient(this.clientFactory, async client => {
            for await (const analysisResult of analysisResultIterator) {
                if (!analysisResult.analysis) {
                    throw new Error("Analysis is undefined!");
                }
                persistResults.push(await this.persistOne(client, analysisResult));
            }
            return persistResults.reduce(combinePersistResults, emptyPersistResult);
        });
    }

    private async persistOne(client: Client, analysisResult: ProjectAnalysisResult): Promise<PersistResult> {
        const repoRef = analysisResult.analysis.id;
        if (!repoRef) {
            return {
                attemptedCount: 1,
                succeeded: [],
                failed: [{
                    repoUrl: "missing repoRef",
                    whileTryingTo: "build object to persist",
                    message: "What is this even, there is no RepoRef",
                }],
            };
        }
        if (!repoRef.url) {
            return {
                attemptedCount: 1,
                succeeded: [],
                failed: [{
                    repoUrl: "missing repoUrl. Repo is named " + repoRef.repo,
                    whileTryingTo: "build object to persist",
                    message: "What is this even, there is no RepoRef",
                }],
            };
        }
        const id = repoRef.url;

        try {
            // Whack any joins
            await client.query(`DELETE from repo_fingerprints WHERE repo_snapshot_id = $1`, [id]);
            await client.query(`DELETE from repo_snapshots WHERE id = $1`, [id]);

            await client.query(`
            INSERT INTO repo_snapshots (id, workspace_id, provider_id, owner, name, url, commit_sha, analysis, query, timestamp)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, current_timestamp)`,
                [id,
                    analysisResult.workspaceId,
                    "github",
                    repoRef.owner,
                    repoRef.repo,
                    repoRef.url,
                    !!analysisResult.analysis.gitStatus ? analysisResult.analysis.gitStatus.sha : repoRef.sha,
                    analysisResult.analysis,
                    (analysisResult as SpideredRepo).query,
                ]);
            await this.persistFingerprints(analysisResult.analysis, id, client);

            return {
                succeeded: [id],
                attemptedCount: 1,
                failed: [],
            };
        } catch (err) {
            return {
                attemptedCount: 1,
                succeeded: [],
                failed: [{
                    repoUrl: repoRef.url,
                    whileTryingTo: "persist in DB",
                    message: err.message,
                }],
            };
        }
    }

    // Persist the fingerprints for this analysis
    private async persistFingerprints(pa: ProjectAnalysis, id: string, client: Client): Promise<void> {
        for (const fp of pa.fingerprints) {
            const featureName = fp.type || "unknown";
            const fingerprintId = featureName + "_" + fp.name + "_" + fp.sha;
            //  console.log("Persist fingerprint " + JSON.stringify(fp) + " for id " + id);
            // Create fp record if it doesn't exist
            await client.query(`INSERT INTO fingerprints (id, name, feature_name, sha, data)
values ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING
`, [fingerprintId, fp.name, featureName, fp.sha, JSON.stringify(fp.data)]);
            await client.query(`INSERT INTO repo_fingerprints (repo_snapshot_id, fingerprint_id)
values ($1, $2) ON CONFLICT DO NOTHING
`, [id, fingerprintId]);
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
    try {
        await client.connect();
    } catch (err) {
        throw new Error("Could not connect to Postgres. Please start it up. Message: " + err.message);
    }
    try {
        result = await what(client);
    } catch (err) {
        console.log(err);
    } finally {
        client.end();
    }
    return result;
}
