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

import { logger } from "@atomist/automation-client";
import { Client } from "pg";
import {
    ClientFactory,
    doWithClient,
} from "../analysis/offline/persist/pgUtils";
import {
    introduceClassificationLayer,
    PlantedTree,
    SunburstTree,
    validatePlantedTree,
} from "../tree/sunburst";

export interface TreeQuery {

    workspaceId: string;

    clientFactory: () => Client;

    aspectName: string;

    rootName: string;

    /**
     * Look for one particular fingerprint?
     */
    byName: boolean;

    includeWithout: boolean;
}

/**
 * Return results for non-matching fingerprints
 */
function nonMatchingRepos(tq: TreeQuery): string {
    return `SELECT  null as id, $3 as name, null as sha, null as data, $1 as type,
            (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_snapshots
                   WHERE workspace_id ${tq.workspaceId === "*" ? "<>" : "="} $1
                   AND repo_snapshots.id not in (select repo_fingerprints.repo_snapshot_id
                    FROM repo_fingerprints WHERE repo_fingerprints.fingerprint_id in
                        (SELECT id from fingerprints where fingerprints.feature_name = $2
                            AND fingerprints.name ${tq.byName ? "=" : "<>"} $3))
                ) repo
         )
         children`;
}

function fingerprintsToReposQuery(tq: TreeQuery): string {
    // We always select by aspect (aka feature_name, aka type), and sometimes also by fingerprint name.
    const sql = `
SELECT row_to_json(fingerprint_groups) FROM (
    SELECT json_agg(fp) as children FROM (
       SELECT
         fingerprints.id as id, fingerprints.name as name, fingerprints.sha as sha,
            fingerprints.data as data, fingerprints.feature_name as type,
         (
             SELECT json_agg(row_to_json(repo)) FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_fingerprints, repo_snapshots
                   WHERE repo_fingerprints.fingerprint_id = fingerprints.id
                    AND repo_snapshots.id = repo_fingerprints.repo_snapshot_id
                    AND workspace_id ${tq.workspaceId === "*" ? "<>" : "="} $1
                ) repo
         ) as children FROM fingerprints
         WHERE fingerprints.feature_name = $2 and fingerprints.name ${tq.byName ? "=" : "<>"} $3
         ${tq.includeWithout ? ("UNION ALL " + nonMatchingRepos(tq)) : ""}
) fp WHERE children is not NULL) as fingerprint_groups
`;
    logger.debug("Running fingerprintsToRepos SQL\n%s", sql);
    return sql;
}

// Question for Rod: why does this use a DB connection and not some abstraction like a Store?
/**
 * Tree where children is one of a range of values, leaves individual repos with one of those values
 * @param {TreeQuery} tq
 * @return {Promise<SunburstTree>}
 */
export async function fingerprintsToReposTree(tq: TreeQuery): Promise<PlantedTree> {
    const children = await doWithClient(tq.clientFactory, async client => {
        const sql = fingerprintsToReposQuery(tq);
        try {
            const results = await client.query(sql,
                [tq.workspaceId, tq.aspectName, tq.rootName]);
            const data = results.rows[0];
            return data.row_to_json.children;
        } catch (err) {
            logger.error("Error running SQL %s: %s", sql, err);
            throw err;
        }
    }, []);
    const result = {
        tree: {
            name: tq.rootName,
            children,
        },
        circles: [
            { meaning: tq.byName ? "fingerprint name" : "aspect" },
            { meaning: "fingerprint value" },
            { meaning: "repo" },
        ],
    };
    validatePlantedTree(result);
    return result;
}

export async function driftTree(workspaceId: string, clientFactory: ClientFactory): Promise<PlantedTree> {
    const sql = `SELECT row_to_json(data) as children FROM (SELECT f0.type as name, json_agg(aspects) as children FROM
(SELECT distinct feature_name as type from fingerprint_analytics) f0, (
    SELECT name, feature_name as type, variants, count, entropy, variants as size
    from fingerprint_analytics f1
    WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1 AND ENTROPY > 0
    ORDER BY entropy desc) as aspects
    WHERE aspects.type = f0.type
    GROUP by f0.type) as data`;
    logger.debug(sql);
    const circles = [
        { meaning: "type" },
        { meaning: "fingerprint name" },
        { meaning: "fingerprint entropy" },
    ];
    return doWithClient(clientFactory, async client => {
        const result = await client.query(sql,
            [workspaceId]);
        let tree: PlantedTree = {
            circles,
            tree: {
                name: "drift",
                children: result.rows.map(r => r.children),
            },
        };
        tree = introduceClassificationLayer(tree, {
            newLayerMeaning: "entropy band",
            newLayerDepth: 0,
            descendantClassifier: toEntropyBand,
        });
        return tree;
    }, err => {
        return {
            circles,
            tree: { name: "failed drift report", children: [] },
            errors: [{ message: err.message }],
        };
    });
}

export async function driftTreeForSingleAspect(workspaceId: string,
                                               type: string,
                                               clientFactory: ClientFactory): Promise<PlantedTree> {
    const sql = `SELECT row_to_json(data) as children FROM (SELECT f0.type as name, json_agg(aspects) as children FROM
(SELECT distinct feature_name as type from fingerprint_analytics) f0, (
    SELECT name, feature_name as type, variants, count, entropy, variants as size
    from fingerprint_analytics f1
    WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1
    ORDER BY entropy desc) as aspects
    WHERE aspects.type = f0.type AND aspects.type = $2
    GROUP by f0.type) as data`;
    logger.debug(sql);
    return doWithClient(clientFactory, async client => {
        const result = await client.query(sql,
            [workspaceId, type]);
        let tree: PlantedTree = {
            circles: [
                { meaning: "type" },
                { meaning: "fingerprint entropy" },
            ],
            tree: {
                name: type,
                children: result.rows[0].children.children,
            },
        };
        tree = introduceClassificationLayer(tree, {
            newLayerMeaning: "entropy band",
            newLayerDepth: 1,
            descendantClassifier: toEntropyBandForSingleAspect,
        });
        return tree;
    });
}

function toEntropyBand(fp: { entropy: number }): string | undefined {
    if (fp.entropy > 2) {
        return "random (>2)";
    }
    if (fp.entropy > 1) {
        return "wild (>1)";
    }
    if (fp.entropy > .5) {
        return "loose (>.5)";
    }
    return undefined;
}

function toEntropyBandForSingleAspect(fp: { entropy: number }): string | undefined {
    /*
    None: = 0
Low: < 1
Medium: < 2
High: >=*2*
     */
    if (fp.entropy === 0) {
        return "None";
    }
    if (fp.entropy < 1) {
        return "Low";
    }
    if (fp.entropy < 2) {
        return "Medium";
    }
    if (fp.entropy >= 2) {
        return "High";
    }
    return undefined;
}
