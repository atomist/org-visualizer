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
import { doWithClient } from "../analysis/offline/persist/pgUtils";
import {
    checkPlantedTreeInvariants,
    PlantedTree,
    SunburstTree,
    visit,
} from "../tree/sunburst";

export interface TreeQuery {

    workspaceId: string;

    clientFactory: () => Client;

    featureName: string;

    rootName: string;

    /**
     * Look for one particular fingerprint?
     */
    byName: boolean;

    includeWithout: boolean;
}

/**
 * Return rows for non-matching fingerprints
 */
function without(byName: boolean): string {
    return `UNION ALL
            SELECT  null as id, $3 as name, null as sha, null as data, $1 as type,
            (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_snapshots
                   WHERE workspace_id = $1
                   AND repo_snapshots.id not in (select repo_fingerprints.repo_snapshot_id
                    FROM repo_fingerprints WHERE repo_fingerprints.fingerprint_id in
                        (SELECT id from fingerprints where fingerprints.feature_name = $2
                            AND fingerprints.name ${byName ? "=" : "<>"} $3))
                ) repo
         )
         children`;
}

function fingerprintsChildrenQuery(byName: boolean, includeWithout: boolean): string {
    // we always select by aspect (aka feature_name, aka type), and sometimes also by fingerprint name.
    const sql = `
SELECT row_to_json(fingerprint_groups) FROM (
    SELECT json_agg(fp) as children FROM (
       SELECT
         fingerprints.id as id, fingerprints.name as name, fingerprints.sha as sha, fingerprints.data as data, fingerprints.feature_name as type,
         (
             SELECT json_agg(row_to_json(repo)) FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_fingerprints, repo_snapshots
                   WHERE repo_fingerprints.fingerprint_id = fingerprints.id
                    AND repo_snapshots.id = repo_fingerprints.repo_snapshot_id
                    AND workspace_id = $1
                ) repo
         ) as children FROM fingerprints WHERE fingerprints.feature_name = $2 and fingerprints.name ${byName ? "=" : "<>"} $3
         ${includeWithout ? without(byName) : ""}
) fp) as fingerprint_groups
`;
    logger.debug("Running SQL\n%s", sql);
    return sql;
}

/**
 * Tree where children is one of a range of values, leaves individual repos with one of those values
 * @param {TreeQuery} opts
 * @return {Promise<SunburstTree>}
 */
export async function repoTree(opts: TreeQuery): Promise<PlantedTree> {
    const children = await doWithClient(opts.clientFactory, async client => {
        const sql = fingerprintsChildrenQuery(opts.byName, opts.includeWithout);
        try {
            const results = await client.query(sql,
                [opts.workspaceId, opts.featureName, opts.rootName]);
            const data = results.rows[0];
            return data.row_to_json.children;
        } catch (err) {
            logger.error("Error running SQL %s: %s", sql, err);
            throw err;
        }
    }, []);
    const result = {
        tree: {
            name: opts.rootName,
            children,
        },
        circles: [
            { meaning: opts.byName ? "fingerprint name" : "aspect" },
            { meaning: "fingerprint value" },
            { meaning: "repo" },
        ],
    };
    checkPlantedTreeInvariants(result);
    return result;
}
