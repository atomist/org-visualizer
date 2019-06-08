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

import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import {
    Express,
    RequestHandler,
} from "express";
import {
    featureManager,
} from "./features";
import { WellKnownReporters } from "./wellKnownReporters";
import {
    FP,
} from "@atomist/sdm-pack-fingerprints";
import * as bodyParser from "body-parser";
import * as _ from "lodash";
import {
    FeatureManager,
} from "../feature/FeatureManager";
import { reportersAgainst } from "../feature/reportersAgainst";
import {
    fingerprintsChildrenQuery,
    repoTree,
} from "../feature/repoTree";
import {
    SunburstTree,
    visit,
} from "../tree/sunburst";
import { Client } from "pg";
import {
    ClientFactory,
    doWithClient,
} from "../analysis/offline/persist/PostgresProjectAnalysisResultStore";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

/**
 * Public API routes, returning JSON
 */
export function api(clientFactory: ClientFactory, store: ProjectAnalysisResultStore): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {

        express.use(bodyParser.json());       // to support JSON-encoded bodies
        express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
            extended: true,
        }));

        express.get("/api/v1/fingerprints", ...handlers, async (req, res) => {
            const workspaceId = req.query.workspace_id || "local";
            const fps = await fingerprints(clientFactory, workspaceId);
            console.log(JSON.stringify(fps));
            res.json(fps);
        });

        /* the d3 sunburst on the /query page uses this */
        express.get("/api/v1/fingerprint", ...handlers, async (req, res) => {
            const workspaceId = req.query.workspace_id || "local";
            const tree = await repoTree({
                clientFactory,
                query: fingerprintsChildrenQuery(`workspace_id = '${workspaceId}'`),
                rootName: req.query.name,
            });
            console.log(JSON.stringify(tree));
            fillInFeatures(featureManager, tree);
            res.json(tree);
        });

        // In memory queries against returns
        express.get("/api/v1/filter", ...handlers, async (req, res) => {
            const repos = await store.loadWhere("workspace_id = 'local'");

            const featureQueries = await reportersAgainst(featureManager, repos.map(r => r.analysis));
            const allQueries = _.merge(featureQueries, WellKnownReporters);

            const cannedQuery = allQueries[req.query.name]({
                ...req.query,
            });
            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            const data = await cannedQuery.toSunburstTree(() => relevantRepos.map(r => r.analysis));
            res.json(data);
        });
    };
}

// Use Features to find names of features
function fillInFeatures(fm: FeatureManager, t: SunburstTree) {
    visit(t, l => {
        if ((l as any).sha) {
            const fp = l as any as FP;
            // It's a fingerprint name
            const feature = fm.featureFor(fp);
            if (feature) {
                fp.name = feature.toDisplayableFingerprint ? feature.toDisplayableFingerprint(fp) : fp.data;
            }
        }
        return true;
    });
}

export interface FingerprintData {
    fingerprintName: string;
    featureName: string;
    appearsIn: number;
}

async function fingerprints(clientFactory: ClientFactory, workspaceId: string): Promise<FingerprintData[]> {
    return doWithClient(clientFactory, async client => {
        const sql = `SELECT distinct rf.name as fingerprintName, feature_name as featureName, count(rs.id) as appearsIn
  from repo_fingerprints rf, repo_snapshots rs
  WHERE rf.repo_snapshot_id = rs.id AND rs.workspace_id = $1
  GROUP by feature_name, fingerprintName`;
        const rows = await client.query(sql, [workspaceId]);
        return rows.rows;
    });
}