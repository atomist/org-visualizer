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
    HttpClientFactory,
    logger,
} from "@atomist/automation-client";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import {
    BaseAspect,
    ConcreteIdeal,
    FP,
    Ideal,
    isConcreteIdeal,
    supportsEntropy,
} from "@atomist/sdm-pack-fingerprints";
import { idealCoordinates } from "@atomist/sdm-pack-fingerprints/lib/machine/Ideal";
import * as bodyParser from "body-parser";
import {
    Express,
    RequestHandler,
} from "express";
import * as _ from "lodash";
import { CSSProperties } from "react";
import serveStatic = require("serve-static");
import {
    AspectFingerprintsForDisplay,
    FingerprintForDisplay,
    OrgExplorer,
} from "../../views/org";
import {
    ProjectAspectForDisplay,
    ProjectExplorer,
} from "../../views/project";
import {
    ProjectForDisplay,
    ProjectList,
} from "../../views/projectList";
import {
    CurrentIdealForDisplay,
    PossibleIdealForDisplay,
    SunburstPage,
} from "../../views/sunburstPage";
import { renderStaticReactNode } from "../../views/topLevelPage";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    AspectRegistry,
    ManagedAspect,
} from "../aspect/AspectRegistry";
import {
    defaultedToDisplayableFingerprint,
    defaultedToDisplayableFingerprintName,
} from "../aspect/DefaultAspectRegistry";
import { TagTree } from "./api";

/**
 * Add the org page route to Atomist SDM Express server.
 * @return {ExpressCustomizer}
 */
export function orgPage(
    aspectRegistry: AspectRegistry,
    store: ProjectAnalysisResultStore,
    httpClientFactory: HttpClientFactory): {
    customizer: ExpressCustomizer,
    routesToSuggestOnStartup: Array<{ title: string, route: string }>,
} {
    const orgRoute = "/org";
    return {
        routesToSuggestOnStartup: [{ title: "Org Visualizations", route: orgRoute }],
        customizer: (express: Express, ...handlers: RequestHandler[]) => {
            express.use(bodyParser.json());       // to support JSON-encoded bodies
            express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
                extended: true,
            }));

            express.use(serveStatic("public", { index: false }));
            express.use(serveStatic("dist", { index: false }));

            /* redirect / to the org page. This way we can go right here
             * for now, and later make a higher-level page if we want.
             */
            express.get("/", ...handlers, async (req, res) => {
                res.redirect(orgRoute);
            });

            exposeDriftPage(express, handlers, httpClientFactory, aspectRegistry);
            exposeOrgPage(express, handlers, orgRoute, aspectRegistry, store);
            exposeProjectListPage(express, handlers, store);
            exposeProjectPage(express, handlers, aspectRegistry, store);
            exposeExplorePage(express, handlers, httpClientFactory, aspectRegistry);
            exposeFingerprintReportPage(express, handlers, httpClientFactory, aspectRegistry);
            exposeCustomReportPage(express, handlers, httpClientFactory, aspectRegistry);
        },
    };
}

function exposeProjectListPage(express: Express,
                               handlers: RequestHandler[],
                               store: ProjectAnalysisResultStore): void {
    express.get("/projects", ...handlers, async (req, res) => {
        const allAnalysisResults = await store.loadInWorkspace(req.query.workspace || req.params.workspace_id);

        // optional query parameter: owner
        const relevantAnalysisResults = allAnalysisResults.filter(ar => req.query.owner ? ar.analysis.id.owner === req.query.owner : true);
        if (relevantAnalysisResults.length === 0) {
            return res.send(`No matching repos for organization ${req.query.owner}`);
        }

        const projectsForDisplay: ProjectForDisplay[] = relevantAnalysisResults.map(ar => ({ id: ar.id, ...ar.analysis.id }));

        return res.send(renderStaticReactNode(
            ProjectList({ projects: projectsForDisplay }),
            "Project list"));
    });
}

function exposeOrgPage(express: Express,
                       handlers: RequestHandler[],
                       orgRoute: string,
                       aspectRegistry: AspectRegistry,
                       store: ProjectAnalysisResultStore): void {
    express.get(orgRoute, ...handlers, async (req, res) => {
        try {
            const repos = await store.loadInWorkspace(req.query.workspace || req.params.workspace_id);
            const fingerprintUsage = await store.fingerprintUsageForType("*");

            const ideals = await aspectRegistry.idealStore.loadIdeals("*");

            const aspectsEligibleForDisplay = aspectRegistry.aspects.filter(a => !!a.displayName)
                .filter(a => fingerprintUsage.some(fu => fu.type === a.name));
            const importantAspects: AspectFingerprintsForDisplay[] = _.sortBy(aspectsEligibleForDisplay, a => a.displayName)
                .map(aspect => {
                    const fingerprintsForThisAspect = fingerprintUsage.filter(fu => fu.type === aspect.name);
                    return {
                        aspect,
                        fingerprints: fingerprintsForThisAspect
                            .map(fp => formatFingerprintUsageForDisplay(aspect, ideals, fp)),
                    };
                });

            const unfoundAspects: BaseAspect[] = aspectRegistry.aspects
                .filter(f => !!f.displayName)
                .filter(f => !fingerprintUsage.some(fu => fu.type === f.name));

            res.send(renderStaticReactNode(OrgExplorer({
                projectsAnalyzed: repos.length,
                importantAspects,
                unfoundAspects,
                projects: repos.map(r => ({ ...r.repoRef, id: r.id })),
            })));
        } catch (e) {
            logger.error(e.stack);
            res.status(500).send("failure");
        }
    });
}

function exposeProjectPage(express: Express,
                           handlers: RequestHandler[],
                           aspectRegistry: AspectRegistry,
                           store: ProjectAnalysisResultStore): void {
    express.get("/project", ...handlers, async (req, res) => {
        const id = req.query.id;
        const analysisResult = await store.loadById(id);
        if (!analysisResult) {
            return res.send(`No project at ${JSON.stringify(id)}`);
        }

        const aspectsAndFingerprints = await projectFingerprints(aspectRegistry, await store.fingerprintsForProject(id));

        // assign style based on ideal
        const ffd: ProjectAspectForDisplay[] = aspectsAndFingerprints.map(aspectAndFingerprints => ({
            ...aspectAndFingerprints,
            fingerprints: aspectAndFingerprints.fingerprints.map(fp => ({
                ...fp,
                idealDisplayString: displayIdeal(fp, aspectAndFingerprints.aspect),
                style: displayStyleAccordingToIdeal(fp),
            })),
        }));

        return res.send(renderStaticReactNode(ProjectExplorer({
            analysisResult,
            aspects: _.sortBy(ffd.filter(f => !!f.aspect.displayName), f => f.aspect.displayName),
        })));
    });
}

function exposeExplorePage(express: Express,
                           handlers: RequestHandler[],
                           httpClientFactory: HttpClientFactory,
                           aspectRegistry: AspectRegistry): void {
    express.get("/explore", ...handlers, async (req, res) => {
        const workspaceId = req.query.workspaceId || "*";
        const dataUrl = `/api/v1/${workspaceId}/explore?tags=${req.query.tags || ""}`;
        return renderDataUrl(workspaceId, { dataUrl, title: "Explorer" }, aspectRegistry, httpClientFactory, req, res);
    });
}

function exposeDriftPage(express: Express,
                         handlers: RequestHandler[],
                         httpClientFactory: HttpClientFactory,
                         aspectRegistry: AspectRegistry): void {
    express.get("/drift", ...handlers, async (req, res) => {
        const workspaceId = req.query.workspaceId || "*";
        const dataUrl = `/api/v1/${workspaceId}/drift` + (req.query.type ? `?type=${req.query.type}` : "");
        return renderDataUrl(workspaceId, {
            dataUrl,
            title: "Drift by aspect",
        }, aspectRegistry, httpClientFactory, req, res);
    });
}

function exposeFingerprintReportPage(express: Express,
                                     handlers: RequestHandler[],
                                     httpClientFactory: HttpClientFactory,
                                     aspectRegistry: AspectRegistry): void {
    express.get("/fingerprint/:type/:name", ...handlers, async (req, res) => {
        const type = req.params.type;
        const name = req.params.name;
        const workspaceId = req.query.workspaceId || "*";
        const dataUrl = `/api/v1/${workspaceId}/fingerprint/${
            encodeURIComponent(type)}/${
            encodeURIComponent(name)}?byOrg=${
        req.query.byOrg === "true"}&presence=${req.query.presence === "true"}&progress=${
        req.query.progress === "true"}&otherLabel=${req.query.otherLabel === "true"}&trim=${
        req.query.trim === "true"}`;
        return renderDataUrl(workspaceId, {
            dataUrl,
            title: `Atomist aspect ${type}/${name}`,
        }, aspectRegistry, httpClientFactory, req, res);
    });
}

function exposeCustomReportPage(express: Express,
                                handlers: RequestHandler[],
                                httpClientFactory: HttpClientFactory,
                                aspectRegistry: AspectRegistry): void {
    express.get("/report/:name", ...handlers, async (req, res) => {
        const name = req.params.name;
        const workspaceId = req.query.workspaceId || "*";
        const queryString = jsonToQueryString(req.query);
        const dataUrl = `/api/v1/${workspaceId}/report/${name}?${queryString}`;
        return renderDataUrl(workspaceId, {
            dataUrl,
            title: `Atomist report ${name}`,
        }, aspectRegistry, httpClientFactory, req, res);
    });
}

// TODO fix any
async function renderDataUrl(workspaceId: string,
                             page: {
                                 title: string,
                                 dataUrl: string,
                             },
                             aspectRegistry: AspectRegistry,
                             httpClientFactory: HttpClientFactory,
                             req: any,
                             res: any): Promise<void> {
    let tree: TagTree;
    let currentIdealForDisplay: CurrentIdealForDisplay;
    const possibleIdealsForDisplay: PossibleIdealForDisplay[] = [];

    const fullUrl = `http://${req.get("host")}${page.dataUrl}`;
    try {
        const result = await httpClientFactory.create().exchange<TagTree>(fullUrl,
            {
                retry: { retries: 0 },
            });
        tree = result.body;
        logger.info(`From ${fullUrl}, got: ` + JSON.stringify(tree.circles, undefined, 2));
    } catch (e) {
        logger.error(`Failure fetching sunburst data from ${fullUrl}: ` + e.message);
    }

    // tslint:disable-next-line
    const aspect = aspectRegistry.aspectOf(req.query.type);
    const fingerprintDisplayName = defaultedToDisplayableFingerprintName(aspect)(req.query.name);

    function idealDisplayValue(ideal: Ideal | undefined): CurrentIdealForDisplay | undefined {
        if (!ideal) {
            return undefined;
        }
        if (!isConcreteIdeal(ideal)) {
            return { displayValue: "eliminate" };
        }
        return { displayValue: defaultedToDisplayableFingerprint(aspect)(ideal.ideal) };
    }

    currentIdealForDisplay = idealDisplayValue(await aspectRegistry.idealStore
        .loadIdeal("local", req.query.type, req.query.name));

    logger.info("Data url=%s", page.dataUrl);

    res.send(renderStaticReactNode(
        SunburstPage({
            workspaceId,
            fingerprintDisplayName,
            currentIdeal: currentIdealForDisplay,
            possibleIdeals: possibleIdealsForDisplay,
            query: req.params.query,
            dataUrl: page.dataUrl,
            tree,
            selectedTags: req.query.tags ? req.query.tags.split(",") : [],
        }),
        page.title,
        [
            "/sunburstScript-bundle.js",
        ]));
}

export function jsonToQueryString(json: object): string {
    return Object.keys(json).map(key =>
        encodeURIComponent(key) + "=" + encodeURIComponent(json[key]),
    ).join("&");
}

function displayIdeal(fingerprint: MelbaFingerprintForDisplay, aspect: ManagedAspect): string {
    if (idealIsDifferentFromActual(fingerprint)) {
        return defaultedToDisplayableFingerprint(aspect)((fingerprint.ideal as ConcreteIdeal).ideal);
    }
    if (idealIsElimination(fingerprint)) {
        return "eliminate";
    }
    return "";
}

function idealIsElimination(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && !isConcreteIdeal(fingerprint.ideal);
}

function idealIsDifferentFromActual(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && isConcreteIdeal(fingerprint.ideal) && fingerprint.ideal.ideal.sha !== fingerprint.sha;
}

function idealIsSameAsActual(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && isConcreteIdeal(fingerprint.ideal) && fingerprint.ideal.ideal.sha === fingerprint.sha;
}

function displayStyleAccordingToIdeal(fingerprint: MelbaFingerprintForDisplay): CSSProperties {
    const redStyle: CSSProperties = { color: "red" };
    const greenStyle: CSSProperties = { color: "green" };

    if (idealIsSameAsActual(fingerprint)) {
        return greenStyle;
    }
    if (idealIsDifferentFromActual(fingerprint)) {
        return redStyle;
    }
    if (idealIsElimination(fingerprint)) {
        return redStyle;
    }
    return {};
}

export type MelbaFingerprintForDisplay = FP & {
    ideal?: Ideal;
    displayValue: string;
    displayName: string;
};

export interface MelbaAspectForDisplay {
    aspect: ManagedAspect;
    fingerprints: MelbaFingerprintForDisplay[];
}

async function projectFingerprints(fm: AspectRegistry, allFingerprintsInOneProject: FP[]): Promise<MelbaAspectForDisplay[]> {
    const result = [];
    for (const aspect of fm.aspects) {
        const originalFingerprints =
            _.sortBy(allFingerprintsInOneProject.filter(fp => aspect.name === (fp.type || fp.name)), fp => fp.name);
        if (originalFingerprints.length > 0) {
            const fingerprints: MelbaFingerprintForDisplay[] = [];
            for (const fp of originalFingerprints) {
                fingerprints.push({
                    ...fp,
                    // ideal: await this.opts.idealResolver(fp.name),
                    displayValue: defaultedToDisplayableFingerprint(aspect)(fp),
                    displayName: defaultedToDisplayableFingerprintName(aspect)(fp.name),
                });
            }
            result.push({
                aspect,
                fingerprints,
            });
        }
    }
    return result;
}

function idealMatchesFingerprint(id: Ideal, fp: FingerprintUsage): boolean {
    const c = idealCoordinates(id);
    return c.type === fp.type && c.name === fp.name;
}

function formatFingerprintUsageForDisplay(aspect: ManagedAspect, ideals: Ideal[], fp: FingerprintUsage): FingerprintForDisplay {
    const foundIdeal = ideals.find(ide => idealMatchesFingerprint(ide, fp));
    const ideal = foundIdeal && isConcreteIdeal(foundIdeal) && aspect.toDisplayableFingerprint ?
        { displayValue: aspect.toDisplayableFingerprint(foundIdeal.ideal) }
        : undefined;
    return {
        ...fp,
        ideal,
        displayName: defaultedToDisplayableFingerprintName(aspect)(fp.name),
        entropy: supportsEntropy(aspect) ? fp.entropy : undefined,
    };
}
