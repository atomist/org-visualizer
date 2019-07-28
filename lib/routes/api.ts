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
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import { isInLocalMode } from "@atomist/sdm-core";
import * as bodyParser from "body-parser";
import {
    Express,
    Request,
    RequestHandler,
    Response,
} from "express";
import * as path from "path";
import * as swaggerUi from "swagger-ui-express";
import * as yaml from "yamljs";
import {
    ClientFactory,
    doWithClient,
} from "../analysis/offline/persist/pgUtils";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
    whereFor,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalyticsForFingerprintKind } from "../analysis/offline/spider/analytics";
import { AspectRegistry } from "../aspect/AspectRegistry";
import {
    driftTree,
    driftTreeForSingleAspect,
} from "../aspect/repoTree";
import { getAspectReports } from "../customize/categories";
import {
    SunburstTree,
    visit,
} from "../tree/sunburst";
import {
    authHandlers,
    configureAuth,
    corsHandler,
} from "./auth";
import { buildFingerprintTree } from "./buildFingerprintTree";
import {
    WellKnownReporters,
} from "./wellKnownReporters";

/**
 * Expose the public API routes, returning JSON.
 * Also expose Swagger API documentation.
 */
export function api(clientFactory: ClientFactory,
                    store: ProjectAnalysisResultStore,
                    aspectRegistry: AspectRegistry): {
    customizer: ExpressCustomizer,
    routesToSuggestOnStartup: Array<{ title: string, route: string }>,
} {
    const serveSwagger = isInLocalMode();
    const docRoute = "/api-docs";
    const routesToSuggestOnStartup = serveSwagger ? [{ title: "Swagger", route: docRoute }] : [];
    return {
        routesToSuggestOnStartup,
        customizer: (express: Express, ...handlers: RequestHandler[]) => {
            express.use(bodyParser.json());       // to support JSON-encoded bodies
            express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
                extended: true,
            }));

            if (serveSwagger) {
                exposeSwaggerDoc(express, docRoute);
            }

            configureAuth(express);

            exposeIdealAndProblemSetting(express, aspectRegistry);

            exposeAspectMetadata(express, store, clientFactory);

            exposeListFingerprints(express, store);

            exposeFingerprintByType(express, store);

            exposeFingerprintByTypeAndName(express, aspectRegistry, clientFactory);

            exposeDrift(express, aspectRegistry, clientFactory);

            // In memory queries against returns
            express.options("/api/v1/:workspace_id/filter/:name", corsHandler());
            express.get("/api/v1/:workspace_id/filter/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
                try {
                    const allQueries = WellKnownReporters;
                    const q = allQueries[req.params.name];
                    if (!q) {
                        throw new Error(`No query named '${req.params.name}'`);
                    }

                    const cannedQuery = q({
                        ...req.query,
                    });

                    const repos = await store.loadWhere(whereFor(req.query.workspace, req.params.workspace_id));
                    const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
                    const data = await cannedQuery.toSunburstTree(() => relevantRepos.map(r => r.analysis));
                    return res.json({ tree: data });
                } catch (e) {
                    logger.warn("Error occurred getting report: %s %s", e.message, e.stack);
                    res.sendStatus(500);
                }
            });

            // Calculate and persist entropy for this fingerprint
            express.put("/api/v1/:workspace/entropy/:type/:name", ...handlers, async (req, res) => {
                await computeAnalyticsForFingerprintKind(store, req.params.workspace, req.params.type, req.params.name);
                res.sendStatus(201);
            });
        },
    };
}

function exposeSwaggerDoc(express: Express, docRoute: string): void {
    const swaggerDocPath = path.join(__dirname, "..", "..", "swagger.yaml");
    const swaggerDocument = yaml.load(swaggerDocPath);
    express.use(docRoute, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

function exposeAspectMetadata(express: Express, store: ProjectAnalysisResultStore, clientFactory: ClientFactory): void {
    // Return the aspects metadata
    express.options("/api/v1/:workspace_id/aspects", corsHandler());
    express.get("/api/v1/:workspace_id/aspects", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const workspaceId = req.params.workspace_id || "local";
            const fingerprintUsage: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId);
            const reports = getAspectReports(fingerprintUsage, workspaceId);
            logger.debug("Returning aspect reports for '%s': %j", workspaceId, reports);

            // TODO cd where should those queries ideally live? @rod
            let sql = `SELECT COUNT(*) FROM (SELECT DISTINCT owner, name FROM repo_snapshots WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1) as repos`;
            const count = await doWithClient(clientFactory, async client => {
                const result = await client.query(sql,
                    [workspaceId]);
                return +result.rows[0].count;
            });
            sql = `SELECT timestamp FROM repo_snapshots WHERE workspace_id ${workspaceId === "*" ? "<>" : "="} $1 ORDER BY timestamp DESC LIMIT 1`;
            const at = await doWithClient(clientFactory, async client => {
                const result = await client.query(sql,
                    [workspaceId]);
                return result.rows[0].timestamp;
            });

            res.json({
                analyzed: {
                    repo_count: count,
                    at,
                },
                reports,
            });
        } catch (e) {
            logger.warn("Error occurred getting aspect metadata: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposeListFingerprints(express: Express, store: ProjectAnalysisResultStore): void {
    // Return all fingerprints
    express.options("/api/v1/:workspace_id/fingerprints", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprints", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const workspaceId = req.params.workspace_id || "local";
            const fingerprintUsage: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId);
            logger.debug("Returning fingerprints for '%s': %j", workspaceId, fingerprintUsage);
            res.json({ list: fingerprintUsage });
        } catch (e) {
            logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposeFingerprintByType(express: Express, store: ProjectAnalysisResultStore): void {
    express.options("/api/v1/:workspace_id/fingerprint/:type", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprint/:type", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const workspaceId = req.params.workspace_id || "*";
            const fps: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId, req.params.type);
            logger.debug("Returning fingerprints of type for '%s': %j", workspaceId, fps);
            res.json({ list: fps });
        } catch (e) {
            logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposeFingerprintByTypeAndName(express: Express,
                                        aspectRegistry: AspectRegistry,
                                        clientFactory: ClientFactory): void {
    express.options("/api/v1/:workspace_id/fingerprint/:type/:name", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprint/:type/:name", [corsHandler(), ...authHandlers()], async (req: Request, res: Response) => {
        const workspaceId = req.params.workspace_id;
        const fingerprintType = req.params.type;
        const fingerprintName = req.params.name;
        const byName = req.params.name !== "*";
        const showPresence = req.query.presence === "true";
        const showProgress = req.query.progress === "true";
        const trim = req.query.trim === "true";
        const byOrg = req.query.byOrg === "true";
        const otherLabel = req.query.otherLabel === "true";

        try {
            const pt = await buildFingerprintTree({ aspectRegistry, clientFactory }, {
                showPresence,
                otherLabel,
                showProgress,
                byOrg,
                trim,
                fingerprintType,
                fingerprintName,
                workspaceId,
                byName,
            });

            res.json(pt);
        } catch (e) {
            logger.warn("Error occurred getting one fingerprint: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposeDrift(express: Express, aspectRegistry: AspectRegistry, clientFactory: ClientFactory): void {
    express.options("/api/v1/:workspace_id/drift", corsHandler());
    express.get("/api/v1/:workspace_id/drift", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                const type = req.query.type;
                const skewTree = type ?
                    await driftTreeForSingleAspect(req.params.workspace_id, type, clientFactory) :
                    await driftTree(req.params.workspace_id, clientFactory);
                fillInAspectNames(aspectRegistry, skewTree.tree);
                return res.json(skewTree);
            } catch
                (err) {
                logger.warn("Error occurred getting drift report: %s %s", err.message, err.stack);
                res.sendStatus(500);
            }
        },
    );
}

function exposeIdealAndProblemSetting(express: Express, aspectRegistry: AspectRegistry): void {
    // Set an ideal
    express.options("/api/v1/:workspace_id/ideal/:id", corsHandler());
    express.put("/api/v1/:workspace_id/ideal/:id", [corsHandler(), ...authHandlers()], async (req, res) => {
        await aspectRegistry.idealStore.setIdeal(req.params.workspace_id, req.params.id);
        logger.info(`Set ideal to ${req.params.id}`);
        res.sendStatus(201);
    });

    // Note this fingerprint as a problem
    express.options("/api/v1/:workspace_id/problem/:id", corsHandler());
    express.put("/api/v1/:workspace_id/problem/:id", [corsHandler(), ...authHandlers()], async (req, res) => {
        await aspectRegistry.problemStore.noteProblem(req.params.workspace_id, req.params.id);
        logger.info(`Set problem at ${req.params.id}`);
        res.sendStatus(201);
    });
}

/**
 * Any nodes that have type and name should be given the fingerprint name from the aspect if possible
 */
function fillInAspectNames(aspectRegistry: AspectRegistry, tree: SunburstTree): void {
    visit(tree, n => {
        const t = n as any;
        if (t.name && t.type) {
            if (t.name && t.type) {
                const aspect = aspectRegistry.aspectOf(t.type);
                if (aspect && aspect.toDisplayableFingerprintName) {
                    n.name = aspect.toDisplayableFingerprintName(n.name);
                }
            }
        }
        return true;
    });
}
