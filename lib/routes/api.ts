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
import {
    BaseAspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import { isConcreteIdeal } from "@atomist/sdm-pack-fingerprints/lib/machine/Ideal";
import * as bodyParser from "body-parser";
import {
    Express,
    Request,
    RequestHandler,
    Response,
} from "express";
import * as path from "path";
import { Client } from "pg";
import * as swaggerUi from "swagger-ui-express";
import * as yaml from "yamljs";
import { ClientFactory } from "../analysis/offline/persist/pgUtils";
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
    fingerprintsToReposTree,
} from "../aspect/repoTree";
import { getAspectReports } from "../customize/categories";
import {
    groupSiblings,
    introduceClassificationLayer,
    PlantedTree,
    SunburstTree,
    trimOuterRim,
    visit,
    visitAsync,
} from "../tree/sunburst";
import {
    authHandlers,
    configureAuth,
    corsHandler,
} from "./auth";
import {
    aspectReport,
    WellKnownReporters,
} from "./wellKnownReporters";

/**
 * Public API routes, returning JSON.
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

            exposeAspectMetadata(express, store);

            exposeListFingerprints(express, store);

            exposeFingerprintByType(express, store);

            exposeFingerprintByTypeAndName(express, aspectRegistry, clientFactory);

            exposeDrift(express, aspectRegistry, clientFactory);

            // In memory queries against returns
            express.options("/api/v1/:workspace_id/filter/:name", corsHandler());
            express.get("/api/v1/:workspace_id/filter/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
                try {

                    if (req.params.name === "aspectReport") {
                        const type = req.query.type;
                        const fingerprints = await store.fingerprintsInWorkspace(req.params.workspace_id, type);
                        const withDups = await store.fingerprintsInWorkspace(req.params.workspace_id, type, undefined, true);
                        logger.info("Found %d fingerprints", fingerprints.length);
                        const aspectTree = await aspectReport(type, aspectRegistry, withDups).toSunburstTree(
                            () => fingerprints);
                        return res.json({ tree: aspectTree });
                    }

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

function resolveAspectNames(fm: AspectRegistry, t: SunburstTree): void {
    visit(t, l => {
        if ((l as any).sha) {
            const fp = l as any as FP;
            // It's a fingerprint name
            const aspect = fm.aspectOf(fp.type);
            if (aspect) {
                fp.name = aspect.toDisplayableFingerprint ? aspect.toDisplayableFingerprint(fp) : fp.data;
            }
        }
        return true;
    });
}

function exposeSwaggerDoc(express: Express, docRoute: string): void {
    const swaggerDocPath = path.join(__dirname, "..", "..", "swagger.yaml");
    const swaggerDocument = yaml.load(swaggerDocPath);
    express.use(docRoute, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

function exposeAspectMetadata(express: Express, store: ProjectAnalysisResultStore): void {
    // Return the aspects metadata
    express.options("/api/v1/:workspace_id/aspects", corsHandler());
    express.get("/api/v1/:workspace_id/aspects", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const workspaceId = req.params.workspace_id || "local";
            const fingerprintUsage: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId);
            const reports = getAspectReports(fingerprintUsage, workspaceId);
            logger.debug("Returning aspect reports for '%s': %j", workspaceId, reports);
            res.json(reports);
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

export async function buildFingerprintTree(
    world: {
        aspectRegistry: AspectRegistry,
        clientFactory: () => Client,
    },
    params: {
        workspaceId: string,
        fingerprintName: string,
        fingerprintType: string,
        byName: boolean,
        otherLabel: boolean,
        showPresence: boolean,
        byOrg: boolean,
        trim: boolean,
        showProgress: boolean,
    }): Promise<PlantedTree> {

    const { workspaceId, byName, fingerprintName, fingerprintType, otherLabel, showPresence, byOrg, trim, showProgress } = params;
    const { clientFactory, aspectRegistry } = world;

    // Get the tree and then perform post processing on it
    let pt = await fingerprintsToReposTree({
        workspaceId,
        clientFactory,
        byName,
        includeWithout: otherLabel,
        rootName: fingerprintName,
        aspectName: fingerprintType,
    });
    logger.debug("Returning fingerprint tree '%s': %j", fingerprintName, pt);

    const usageChecker = await aspectRegistry.undesirableUsageCheckerFor("local");
    // Flag bad fingerprints with a special color
    await visitAsync(pt.tree, async l => {
        if ((l as any).sha) {
            const problem = await usageChecker.check("local", l as any);
            if (problem) {
                (l as any).color = "#810325";
                (l as any).problem = {
                    // Need to dispense with the fingerprint, which would make this circular
                    description: problem.description,
                    severity: problem.severity,
                    authority: problem.authority,
                    url: problem.url,
                };
            }
        }
        return true;
    });
    if (!byName) {
        // Show all fingerprints in one aspect, splitting by fingerprint name
        pt = introduceClassificationLayer<{ data: any, type: string }>(pt,
            {
                descendantClassifier: l => {
                    if (!(l as any).sha) {
                        return undefined;
                    }
                    const aspect2: BaseAspect = aspectRegistry.aspectOf(l.type);
                    return !aspect2 || !aspect2.toDisplayableFingerprintName ?
                        l.name :
                        aspect2.toDisplayableFingerprintName(l.name);
                },
                newLayerDepth: 1,
                newLayerMeaning: "fingerprint name",
            });
        const aspect = aspectRegistry.aspectOf(fingerprintType);
        if (!!aspect) {
            pt.tree.name = aspect.displayName;
        }
    } else {
        // We are showing a particular fingerprint
        const aspect = aspectRegistry.aspectOf(pt.tree.name);
        if (!!aspect) {
            pt.tree.name = aspect.displayName;
        }
    }

    resolveAspectNames(aspectRegistry, pt.tree);
    if (byOrg) {
        // Group by organization via an additional layer at the center
        pt = introduceClassificationLayer<{ owner: string }>(pt,
            {
                descendantClassifier: l => l.owner,
                newLayerDepth: 1,
                newLayerMeaning: "owner",
            });
    }
    if (showPresence) {
        pt.tree = groupSiblings(pt.tree,
            {
                parentSelector: parent => parent.children.some(c => (c as any).sha),
                childClassifier: kid => (kid as any).sha ? "Yes" : "No",
                collapseUnderName: name => name === "No",
            });
    } else if (showProgress) {
        const ideal = await aspectRegistry.idealStore.loadIdeal(workspaceId, fingerprintType, fingerprintName);
        if (!ideal || !isConcreteIdeal(ideal)) {
            throw new Error(`No ideal to aspire to for ${fingerprintType}/${fingerprintName} in workspace '${workspaceId}'`);
        }
        pt.tree = groupSiblings(pt.tree, {
            parentSelector: parent => parent.children.some(c => (c as any).sha),
            childClassifier: kid => (kid as any).sha === ideal.ideal.sha ? "Ideal" : "No",
            groupLayerDecorator: l => {
                if (l.name === "Ideal") {
                    (l as any).color = "#168115";
                } else {
                    (l as any).color = "#811824";
                }
            },
        });
    }

    // Group all fingerprint nodes by their name at the first level
    pt.tree = groupSiblings(pt.tree, {
        parentSelector: parent => parent.children.some(c => (c as any).sha),
        childClassifier: l => l.name,
        collapseUnderName: () => true,
    });

    if (trim) {
        pt.tree = trimOuterRim(pt.tree);
    }

    return pt;
}

function exposeDrift(express: Express, aspectRegistry: AspectRegistry, clientFactory: ClientFactory): void {
    express.options("/api/v1/:workspace_id/drift", corsHandler());
    express.get("/api/v1/:workspace_id/drift", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const type = req.query.type;

            if (!type) {
                const skewTree = await driftTree(req.params.workspace_id, clientFactory);
                return res.json(skewTree);
            } else {
                const skewTree = await driftTreeForSingleAspect(req.params.workspace_id, type, clientFactory);
                return res.json(skewTree);
            }
        } catch (err) {
            logger.warn("Error occurred getting drift report: %s %s", err.message, err.stack);
            res.sendStatus(500);
        }
    });
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
