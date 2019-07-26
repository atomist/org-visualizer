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
} from "@atomist/sdm-pack-fingerprints";
import { idealCoordinates } from "@atomist/sdm-pack-fingerprints/lib/machine/Ideal";
import * as bodyParser from "body-parser";
import {
    Express,
    Request,
    RequestHandler,
} from "express";
import * as _ from "lodash";
import {
    CSSProperties,
    ReactElement,
} from "react";
import * as ReactDOMServer from "react-dom/server";
import serveStatic = require("serve-static");
import {
    AspectForDisplay,
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
import { TopLevelPage } from "../../views/topLevelPage";
import {
    ProjectAnalysisResultStore,
    whereFor,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    AspectRegistry,
    ManagedAspect,
} from "../aspect/AspectRegistry";
import {
    defaultedToDisplayableFingerprint,
    defaultedToDisplayableFingerprintName,
} from "../aspect/DefaultAspectRegistry";
import {
    PlantedTree,
    SunburstCircleMetadata,
} from "../tree/sunburst";
import { buildFingerprintTree } from "./api";

function renderStaticReactNode(body: ReactElement,
                               title?: string,
                               extraScripts?: string[]): string {
    return ReactDOMServer.renderToStaticMarkup(
        TopLevelPage({
            bodyContent: body,
            pageTitle: title,
            extraScripts,
        }));
}

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
            /* the org page itself */
            express.get(orgRoute, ...handlers, async (req, res) => {
                try {
                    const repos = await store.loadWhere(whereFor(req.query.workspace, req.params.workspace_id));

                    const fingerprintUsage = await store.fingerprintUsageForType("*");

                    const actionableFingerprints = [];
                    const ideals = await aspectRegistry.idealStore.loadIdeals("*");

                    const importAspects: AspectForDisplay[] = _.sortBy(aspectRegistry.aspects, a => a.displayName || a.name)
                        .filter(f => !!f.displayName)
                        .filter(f => fingerprintUsage.some(fu => fu.type === f.name))
                        .map(aspect => ({
                            aspect,
                            fingerprints: fingerprintUsage.filter(fu => fu.type === aspect.name)
                                .map(fu => ({
                                    ...fu,
                                    aspect,
                                })),
                        }));
                    for (const ffd of importAspects) {
                        for (const fp of ffd.fingerprints) {
                            const ideal = ideals.find(id => {
                                const c = idealCoordinates(id);
                                return c.type === fp.type && c.name === fp.name;
                            });
                            if (ideal && isConcreteIdeal(ideal) && ffd.aspect.toDisplayableFingerprint) {
                                fp.ideal = { displayValue: ffd.aspect.toDisplayableFingerprint(ideal.ideal) };
                            }
                        }
                    }

                    const unfoundAspects: BaseAspect[] = aspectRegistry.aspects
                        .filter(f => !!f.displayName)
                        .filter(f => !fingerprintUsage.some(fu => fu.type === f.name));

                    res.send(renderStaticReactNode(OrgExplorer({
                        actionableFingerprints,
                        projectsAnalyzed: repos.length,
                        importantAspects: importAspects,
                        unfoundAspects,
                        projects: repos.map(r => ({ ...r.repoRef, id: r.id })),
                    })));
                } catch
                (e) {
                    logger.error(e.stack);
                    res.status(500).send("failure");
                }
            },
            );

            /* Project list page */
            express.get("/projects", ...handlers, async (req, res) => {
                const allAnalysisResults = await store.loadWhere(whereFor(req.query.workspace, req.params.workspace_id));

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

            /* the project page */
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

            /* the query page */
            express.get("/query", ...handlers, async (req, res) => {
                let dataUrl: string;
                let currentIdealForDisplay: CurrentIdealForDisplay;
                const possibleIdealsForDisplay: PossibleIdealForDisplay[] = [];

                const workspaceId = req.query.workspaceId || "*";
                const queryString = jsonToQueryString(req.query);

                if (req.query.skew) {
                    dataUrl = `/api/v1/${workspaceId}/drift`;
                } else {
                    dataUrl = !!req.query.filter ?
                        `/api/v1/${workspaceId}/filter/${req.query.name}?${queryString}` :
                        `/api/v1/${workspaceId}/fingerprint/${
                        encodeURIComponent(req.query.type)}/${
                        encodeURIComponent(req.query.name)}?byOrg=${
                        req.query.byOrg === "true"}&presence=${req.query.presence === "true"}&progress=${
                        req.query.progress === "true"}&otherLabel=${req.query.otherLabel === "true"}&trim=${
                        req.query.trim === "true"}`;
                }

                let tree: PlantedTree;
                const fullUrl = `http://${req.get("host")}${dataUrl}`;
                try {
                    const result = await httpClientFactory.create().exchange<PlantedTree>(fullUrl,
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

                logger.info("Data url=%s", dataUrl);

                res.send(renderStaticReactNode(
                    SunburstPage({
                        fingerprintDisplayName,
                        currentIdeal: currentIdealForDisplay,
                        possibleIdeals: possibleIdealsForDisplay,
                        query: req.params.query,
                        dataUrl,
                        tree,
                    }),
                    "Atomist Aspect",
                    [
                        "/sunburstScript-bundle.js",
                    ]));
            });
        },
    };
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
