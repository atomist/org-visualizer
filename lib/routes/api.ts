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
    RequestHandler,
} from "express";
import * as _ from "lodash";
import * as path from "path";
import * as swaggerUi from "swagger-ui-express";
import * as yaml from "yamljs";
import { ClientFactory } from "../analysis/offline/persist/pgUtils";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { computeAnalyticsForFingerprintKind } from "../analysis/offline/spider/analytics";
import { AspectRegistry } from "../aspect/AspectRegistry";
import { reportersAgainst } from "../aspect/reportersAgainst";
import { repoTree } from "../aspect/repoTree";
import { getAspectReports } from "../customize/categories";
import {
    groupSiblings,
    introduceClassificationLayer,
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
import { whereFor } from "./orgPage";
import {
    aspectReport,
    skewReport,
    WellKnownReporters,
} from "./wellKnownReporters";

/**
 * Public API routes, returning JSON.
 * Also expose Swagger API documentation.
 */
export function api(clientFactory: ClientFactory,
                    store: ProjectAnalysisResultStore,
                    aspectRegistry: AspectRegistry): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {

        express.use(bodyParser.json());       // to support JSON-encoded bodies
        express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
            extended: true,
        }));

        // We currently only enable api-docs when in local mode
        if (isInLocalMode()) {
            const swaggerDocPath = path.join(__dirname, "..", "..", "swagger.yaml");
            const swaggerDocument = yaml.load(swaggerDocPath);

            express.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
        }

        configureAuth(express);

        express.options("/api/v1/:workspace_id/ideal/:id", corsHandler());
        express.put("/api/v1/:workspace_id/ideal/:id", [corsHandler(), ...authHandlers()], async (req, res) => {
            await aspectRegistry.idealStore.setIdeal(req.params.workspace_id, req.params.id);
            logger.info(`Set ideal to ${req.params.id}`);
            res.sendStatus(201);
        });

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
                logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        // Return all fingerprints
        express.options("/api/v1/:workspace_id/fingerprints", corsHandler());
        express.get("/api/v1/:workspace_id/fingerprints", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                const workspaceId = req.params.workspace_id || "local";
                const fingerprintUsage: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId);
                logger.debug("Returning fingerprints for '%s': %j", workspaceId, fingerprintUsage);
                res.json(fingerprintUsage);
            } catch (e) {
                logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        express.options("/api/v1/:workspace_id/fingerprint/:type", corsHandler());
        express.get("/api/v1/:workspace_id/fingerprint/:type", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                const workspaceId = req.params.workspace_id || "local";
                const fps = await store.fingerprintUsageForType(workspaceId, req.params.type);
                logger.debug("Returning fingerprints of type for '%s': %j", workspaceId, fps);
                res.json(fps);
            } catch (e) {
                logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        /* the d3 sunburst on the /query page uses this */
        express.options("/api/v1/:workspace_id/fingerprint/:type/:name", corsHandler());
        express.get("/api/v1/:workspace_id/fingerprint/:type/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
            const byName = req.params.name !== "*";
            let workspaceId = req.params.workspace_id;
            if (workspaceId === "*") {
                workspaceId = "local";
            }
            try {
                // Get the tree and then perform post processing on it
                let pt = await repoTree({
                    workspaceId,
                    clientFactory,
                    byName,
                    includeWithout: req.query.otherLabel === "true",
                    rootName: req.params.name,
                    aspectName: req.params.type,
                });
                logger.debug("Returning fingerprint tree '%s': %j", req.params.name, pt);

                // Flag bad fingerprints with a special color
                await visitAsync(pt.tree, async l => {
                    if ((l as any).sha && await aspectRegistry.undesirableUsageChecker.check("local", l as any)) {
                        (l as any).color = "#810325";
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
                            newLayerDepth: 0,
                            newLayerMeaning: "fingerprint name",
                        });
                    const aspect = aspectRegistry.aspectOf(req.params.type);
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
                if (req.query.byOrg === "true") {
                    // Group by organization via an additional layer at the center
                    pt = introduceClassificationLayer<{ owner: string }>(pt,
                        {
                            descendantClassifier: l => l.owner,
                            newLayerDepth: 0,
                            newLayerMeaning: "owner",
                        });
                }
                if (req.query.presence === "true") {
                    pt.tree = groupSiblings(pt.tree,
                        {
                            parentSelector: parent => parent.children.some(c => (c as any).sha),
                            childClassifier: kid => (kid as any).sha ? "Yes" : "No",
                            collapseUnderName: name => name === "No",
                        });
                } else if (req.query.progress === "true") {
                    const ideal = await aspectRegistry.idealStore.loadIdeal(workspaceId, req.params.type, req.params.name);
                    if (!ideal || !isConcreteIdeal(ideal)) {
                        throw new Error(`No ideal to aspire to for ${req.params.type}/${req.params.name}`);
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

                if (req.query.trim === "true") {
                    pt.tree = trimOuterRim(pt.tree);
                }

                res.json(pt.tree);
            } catch (e) {
                logger.warn("Error occurred getting one fingerprint: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        // In memory queries against returns
        express.options("/api/v1/:workspace_id/filter/:name", corsHandler());
        express.get("/api/v1/:workspace_id/filter/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
            try {
                if (req.params.name === "skew") {
                    const fingerprintUsage = await store.fingerprintUsageForType(req.params.workspace_id);
                    logger.info("Found %d fingerprint kinds used", fingerprintUsage.length);
                    const skewTree = await skewReport(aspectRegistry).toSunburstTree(
                        () => fingerprintUsage);
                    return res.json(skewTree);
                }

                if (req.params.name === "") {
                    const type = req.query.type;
                    const fingerprints = await store.fingerprintsInWorkspace(req.params.workspace_id, type);
                    const withDups = await store.fingerprintsInWorkspace(req.params.workspace_id, type, undefined, true);
                    logger.info("Found %d fingerprints", fingerprints.length);
                    const aspectTree = await aspectReport(type, aspectRegistry, withDups).toSunburstTree(
                        () => fingerprints);
                    return res.json(aspectTree);
                }

                const aspectQueries = await reportersAgainst(
                    () => store.distinctFingerprintKinds(req.params.workspace_id), aspectRegistry);
                const allQueries = _.merge(aspectQueries, WellKnownReporters);

                const cannedQuery = allQueries[req.params.name]({
                    ...req.query,
                });

                const repos = await store.loadWhere(whereFor(req));
                const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
                const data = await cannedQuery.toSunburstTree(() => relevantRepos.map(r => r.analysis));
                return res.json(data);
            } catch (e) {
                logger.warn("Error occurred getting fingerprint: %s %s", e.message, e.stack);
                res.sendStatus(500);
            }
        });

        // Calculate and persist entropy for this fingerprint
        express.put("/api/v1/:workspace/entropy/:type/:name", ...handlers, async (req, res) => {
            await computeAnalyticsForFingerprintKind(store, req.params.workspace, req.params.type, req.params.name);
            res.sendStatus(201);
        });
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
