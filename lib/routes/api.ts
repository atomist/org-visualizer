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
    isConcreteIdeal,
} from "@atomist/sdm-pack-fingerprints";
import * as bodyParser from "body-parser";
import {
    Express,
    Request,
    RequestHandler,
    Response,
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
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import {
    AspectRegistry,
    Tag,
} from "../aspect/AspectRegistry";
import {
    driftTreeForAllAspects,
    driftTreeForSingleAspect,
} from "../aspect/repoTree";
import { getAspectReports } from "../customize/categories";
import { CustomReporters } from "../customize/customReporters";
import {
    scoreRepos,
} from "../scorer/scoring";
import {
    PlantedTree,
    SunburstTree,
    TagUsage,
} from "../tree/sunburst";
import {
    killChildren,
    trimOuterRim,
    visit,
} from "../tree/treeUtils";
import {
    authHandlers,
    configureAuth,
    corsHandler,
} from "./auth";
import {
    buildFingerprintTree,
    splitByOrg,
} from "./buildFingerprintTree";
import {
    tagUsageIn,
} from "./support/tagUtils";

/**
 * Expose the public API routes, returning JSON.
 * Also expose Swagger API documentation.
 */
export function api(clientFactory: ClientFactory,
                    projectAnalysisResultStore: ProjectAnalysisResultStore,
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
            exposeAspectMetadata(express, projectAnalysisResultStore);
            exposeListFingerprints(express, projectAnalysisResultStore);
            exposeFingerprintByType(express, aspectRegistry, projectAnalysisResultStore);
            exposeExplore(express, aspectRegistry, projectAnalysisResultStore);
            exposeFingerprintByTypeAndName(express, aspectRegistry, clientFactory, projectAnalysisResultStore);
            exposeDrift(express, aspectRegistry, clientFactory);
            exposeCustomReports(express, projectAnalysisResultStore);
            exposePersistEntropy(express, projectAnalysisResultStore, handlers);
        },
    };
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
            const count = await store.distinctRepoCount(workspaceId);
            const at = await store.latestTimestamp(workspaceId);

            res.json({
                list: reports,
                analyzed: {
                    repo_count: count,
                    at,
                },
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

function exposeFingerprintByType(express: Express,
                                 aspectRegistry: AspectRegistry,
                                 store: ProjectAnalysisResultStore): void {
    express.options("/api/v1/:workspace_id/fingerprint/:type", corsHandler());
    express.get("/api/v1/:workspace_id/fingerprint/:type", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const workspaceId = req.params.workspace_id || "*";
            const type = req.params.type;
            const fps: FingerprintUsage[] = await store.fingerprintUsageForType(workspaceId, type);
            fillInAspectNamesInList(aspectRegistry, fps);
            logger.debug("Returning fingerprints of type for '%s': %j", workspaceId, fps);
            res.json({
                list: fps,
                analyzed: {
                    count: fps.length,
                    variants: _.sumBy(fps, "variants"),
                },
            });
        } catch (e) {
            logger.warn("Error occurred getting fingerprints: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposeFingerprintByTypeAndName(express: Express,
                                        aspectRegistry: AspectRegistry,
                                        clientFactory: ClientFactory,
                                        store: ProjectAnalysisResultStore): void {
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

            const ideal = await aspectRegistry.idealStore.loadIdeal(workspaceId, fingerprintType, fingerprintName);
            let target;
            if (isConcreteIdeal(ideal)) {
                const aspect = aspectRegistry.aspectOf(fingerprintType);
                if (!!aspect && !!aspect.toDisplayableFingerprint) {
                    target = {
                        ...ideal.ideal,
                        value: aspect.toDisplayableFingerprint(ideal.ideal),
                    };
                }
            }

            res.json({
                ...pt,
                target,
            });
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
                let driftTree = type ?
                    await driftTreeForSingleAspect(req.params.workspace_id, type, clientFactory) :
                    await driftTreeForAllAspects(req.params.workspace_id, clientFactory);
                fillInAspectNames(aspectRegistry, driftTree.tree);
                if (!type) {
                    driftTree = removeAspectsWithoutMeaningfulEntropy(aspectRegistry, driftTree);
                }
                driftTree.tree = flattenSoleFingerprints(driftTree.tree);
                return res.json(driftTree);
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

function exposeExplore(express: Express, aspectRegistry: AspectRegistry, store: ProjectAnalysisResultStore): void {
    express.options("/api/v1/:workspace_id/explore", corsHandler());
    express.get("/api/v1/:workspace_id/explore", [corsHandler(), ...authHandlers()], async (req, res) => {
        const workspaceId = req.params.workspace_id || "*";
        const repos = await store.loadInWorkspace(workspaceId, true);
        const selectedTags: string[] = req.query.tags ? req.query.tags.split(",") : [];

        const taggedRepos = await aspectRegistry.tagAndScoreRepos(repos);

        const relevantRepos = taggedRepos.filter(repo => selectedTags.every(tag => relevant(tag, repo)));
        logger.info("Found %d relevant repos of %d", relevantRepos.length, repos.length);

        const allTags = tagUsageIn(aspectRegistry, relevantRepos);

        let repoTree: PlantedTree = {
            circles: [{ meaning: "tags" }, { meaning: "repo" }],
            tree: {
                name: describeSelectedTagsToAnimals(selectedTags),
                children: relevantRepos.map(r => {
                    return {
                        id: r.id,
                        owner: r.repoRef.owner,
                        repo: r.repoRef.repo,
                        name: r.repoRef.repo,
                        url: r.repoRef.url,
                        size: r.analysis.fingerprints.length,
                        tags: r.tags,
                        weightedScore: r.weightedScore,
                    };
                }),
            },
        };

        if (req.query.byOrg !== "false") {
            repoTree = splitByOrg(repoTree);
        }

        const tagTree: TagTree = {
            tags: allTags,
            selectedTags,
            repoCount: repos.length,
            matchingRepoCount: relevantRepos.length,
            // TODO fix this
            averageFingerprintCount: -1,
            ...repoTree,
        };
        res.send(tagTree);
    });
}

export interface TagContext {

    /**
     * All repos available
     */
    repoCount: number;

    /**
     * Average number of distinct fingerprint types in the workspace
     */
    averageFingerprintCount: number;
}

export interface TagTree extends TagContext, PlantedTree {
    matchingRepoCount: number;
    tags: TagUsage[];
    selectedTags: string[];
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

function removeAspectsWithoutMeaningfulEntropy(aspectRegistry: AspectRegistry, driftTree: PlantedTree): PlantedTree {
    // Remove anything where entropy isn't meaningful
    driftTree.tree = killChildren(driftTree.tree, child => {
        const t = child as any;
        if (t.type) {
            const aspect = aspectRegistry.aspectOf(t.type);
            return !!aspect && !!aspect.stats && aspect.stats.defaultStatStatus.entropy === false;
        }
        return false;
    });
    return driftTree;
}

function flattenSoleFingerprints(tree: SunburstTree): SunburstTree {
    // Remove anything where entropy isn't meaningful
    return trimOuterRim(tree, container => container.children.length === 1);
}

/**
 * Fill in aspect names
 */
function fillInAspectNamesInList(aspectRegistry: AspectRegistry, fingerprints: FingerprintUsage[]): void {
    fingerprints.forEach(fp => {
        const aspect = aspectRegistry.aspectOf(fp.type);
        if (!!aspect && !!aspect.toDisplayableFingerprintName) {
            (fp as any).displayName = aspect.toDisplayableFingerprintName(fp.name);
        }
        // This is going to be needed for the invocation of the command handlers to set targets
        (fp as any).fingerprint = `${fp.type}::${fp.name}`;
    });
}

function exposeCustomReports(express: Express, store: ProjectAnalysisResultStore): void {
    // In memory queries against returns
    express.options("/api/v1/:workspace_id/report/:name", corsHandler());
    express.get("/api/v1/:workspace_id/report/:name", [corsHandler(), ...authHandlers()], async (req, res) => {
        try {
            const q = CustomReporters[req.params.name];
            if (!q) {
                throw new Error(`No report named '${req.params.name}'`);
            }

            const repos = await store.loadInWorkspace(req.query.workspace || req.params.workspace_id, true);
            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            let pt = await q.builder.toPlantedTree(() => relevantRepos.map(r => r.analysis));
            if (req.query.byOrg !== "false") {
                pt = splitByOrg(pt);
            }
            return res.json(pt);
        } catch (e) {
            logger.warn("Error occurred getting report: %s %s", e.message, e.stack);
            res.sendStatus(500);
        }
    });
}

function exposePersistEntropy(express: Express, store: ProjectAnalysisResultStore, handlers: RequestHandler[]): void {
    // Calculate and persist entropy for this fingerprint
    express.put("/api/v1/:workspace/entropy/:type/:name", ...handlers, async (req, res) => {
        await computeAnalyticsForFingerprintKind(store, req.params.workspace, req.params.type, req.params.name);
        res.sendStatus(201);
    });
}

function relevant(selectedTag: string, repo: ProjectAnalysisResult & { tags: Tag[] }): boolean {
    const repoTags = repo.tags.map(tag => tag.name);
    return selectedTag.startsWith("!") ? !repoTags.includes(selectedTag.substr(1)) : repoTags.includes(selectedTag);
}

export function describeSelectedTagsToAnimals(selectedTags: string[]): string {
    return selectedTags.map(t => t.replace("!", "not ")).join(" and ") || "All";
}
