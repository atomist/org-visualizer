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
import {
    ConcreteIdeal,
    FP,
    Ideal,
    isConcreteIdeal,
} from "@atomist/sdm-pack-fingerprints";
import { BaseFeature } from "@atomist/sdm-pack-fingerprints/lib/machine/Feature";
import { idealCoordinates } from "@atomist/sdm-pack-fingerprints/lib/machine/Ideal";
import * as bodyParser from "body-parser";
import {
    Express,
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
    ProjectExplorer,
    ProjectFeatureForDisplay,
} from "../../views/project";
import {
    ProjectForDisplay,
    ProjectList,
} from "../../views/projectList";
import {
    CurrentIdealForDisplay,
    PossibleIdealForDisplay,
    SunburstQuery,
} from "../../views/sunburstQuery";
import { TopLevelPage } from "../../views/topLevelPage";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    AspectRegistry,
    ManagedAspect,
} from "../feature/AspectRegistry";
import {
    defaultedToDisplayableFingerprint,
    defaultedToDisplayableFingerprintName,
} from "../feature/DefaultFeatureManager";
import { reportersAgainst } from "../feature/reportersAgainst";
import { WellKnownReporters } from "./wellKnownReporters";

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
export function orgPage(aspectRegistry: AspectRegistry, store: ProjectAnalysisResultStore): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {
        express.use(bodyParser.json());       // to support JSON-encoded bodies
        express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
            extended: true,
        }));

        express.use(serveStatic("public", { index: false }));

        /* redirect / to the org page. This way we can go right here
         * for now, and later make a higher-level page if we want.
         */
        express.get("/", ...handlers, async (req, res) => {
            res.redirect("/org");
        });
        /* the org page itself */
        express.get("/org", ...handlers, async (req, res) => {
                try {
                    const repos = await store.loadWhere(whereFor(req));

                    const fingerprintUsage = await store.fingerprintUsageForType("*");

                    const actionableFingerprints = [];
                    const ideals = await aspectRegistry.idealStore.loadIdeals("local");

                    const importantFeatures: AspectForDisplay[] = aspectRegistry.features
                        .filter(f => !!f.displayName)
                        .filter(f => fingerprintUsage.some(fu => fu.type === f.name))
                        .map(feature => ({
                            feature,
                            fingerprints: fingerprintUsage.filter(fu => fu.type === feature.name)
                                .map(fu => ({
                                    ...fu,
                                    featureName: feature.name,
                                })),
                        }));
                    for (const ffd of importantFeatures) {
                        for (const fp of ffd.fingerprints) {
                            const ideal = ideals.find(id => {
                                const c = idealCoordinates(id);
                                return c.type === fp.type && c.name === fp.name;
                            });
                            if (ideal && isConcreteIdeal(ideal) && ffd.feature.toDisplayableFingerprint) {
                                fp.ideal = { displayValue: ffd.feature.toDisplayableFingerprint(ideal.ideal) };
                            }
                        }
                    }

                    const unfoundFeatures: BaseFeature[] = aspectRegistry.features
                        .filter(f => !!f.displayName)
                        .filter(f => !fingerprintUsage.some(fu => fu.type === f.name));

                    res.send(renderStaticReactNode(OrgExplorer({
                        actionableFingerprints,
                        projectsAnalyzed: repos.length,
                        importantAspects: importantFeatures,
                        unfoundAspects: unfoundFeatures,
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
            const allAnalysisResults = await store.loadWhere(whereFor(req));

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
            const ffd: ProjectFeatureForDisplay[] = aspectsAndFingerprints.map(featureAndFingerprints => ({
                ...featureAndFingerprints,
                fingerprints: featureAndFingerprints.fingerprints.map(fp => ({
                    ...fp,
                    idealDisplayString: displayIdeal(fp, featureAndFingerprints.feature),
                    style: displayStyleAccordingToIdeal(fp),
                })),
            }));

            return res.send(renderStaticReactNode(ProjectExplorer({
                analysisResult,
                features: _.sortBy(ffd.filter(f => !!f.feature.displayName), f => f.feature.displayName),
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
                    dataUrl = `/api/v1/${workspaceId}/filter/skew`;
                } else {
                    dataUrl = !!req.query.filter ?
                        `/api/v1/${workspaceId}/filter/${req.query.name}?${queryString}` :
                        `/api/v1/${workspaceId}/fingerprint/${
                            encodeURIComponent(req.query.type)}/${
                            encodeURIComponent(req.query.name)}?byOrg=${
                        req.query.byOrg === "true"}&presence=${req.query.presence === "true"}&progress=${req.query.progress === "true"}&otherLabel=${req.query.otherLabel === "true"}`;
                }

                // tslint:disable-next-line
                const feature = aspectRegistry.aspectOf(req.query.type);
                const fingerprintDisplayName = defaultedToDisplayableFingerprintName(feature)(req.query.name);

                function idealDisplayValue(ideal: Ideal | undefined): CurrentIdealForDisplay | undefined {
                    if (!ideal) {
                        return undefined;
                    }
                    if (!isConcreteIdeal(ideal)) {
                        return { displayValue: "eliminate" };
                    }
                    return { displayValue: defaultedToDisplayableFingerprint(feature)(ideal.ideal) };
                }

                currentIdealForDisplay = idealDisplayValue(await aspectRegistry.idealStore
                    .loadIdeal("local", req.query.type, req.query.name));

                logger.info("Data url=%s", dataUrl);

                res.send(renderStaticReactNode(
                    SunburstQuery({
                        fingerprintDisplayName,
                        currentIdeal: currentIdealForDisplay,
                        possibleIdeals: possibleIdealsForDisplay,
                        query: req.params.query,
                        dataUrl,
                    }),
                    "Atomist Aspect",
                    [
                        "/lib/d3.v4.min.js",
                        "/js/sunburst.js",
                    ]));
            },
        );

    }
        ;
}

export function whereFor(req): string {
    const wsid = req.query.workspace || req.params.workspace_id;
    if (wsid === "*") {
        return "true";
    }
    return wsid ? `workspace_id = '${wsid}'` : "true";
}

export function jsonToQueryString(json: object): string {
    return Object.keys(json).map(key =>
        encodeURIComponent(key) + "=" + encodeURIComponent(json[key]),
    ).join("&");
}

function displayIdeal(fingerprint: MelbaFingerprintForDisplay, feature: ManagedAspect): string {
    if (idealIsDifferentFromActual(fingerprint)) {
        return defaultedToDisplayableFingerprint(feature)((fingerprint.ideal as ConcreteIdeal).ideal);
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
    feature: ManagedAspect;
    fingerprints: MelbaFingerprintForDisplay[];
}

async function projectFingerprints(fm: AspectRegistry, allFingerprintsInOneProject: FP[]): Promise<MelbaAspectForDisplay[]> {
    const result = [];
    for (const feature of fm.features) {
        const originalFingerprints =
            _.sortBy(allFingerprintsInOneProject.filter(fp => feature.name === (fp.type || fp.name)), fp => fp.name);
        if (originalFingerprints.length > 0) {
            const fingerprints: MelbaFingerprintForDisplay[] = [];
            for (const fp of originalFingerprints) {
                fingerprints.push({
                    ...fp,
                    // ideal: await this.opts.idealResolver(fp.name),
                    displayValue: defaultedToDisplayableFingerprint(feature)(fp),
                    displayName: defaultedToDisplayableFingerprintName(feature)(fp.name),
                });
            }
            result.push({
                feature,
                fingerprints,
            });
        }
    }
    return result;
}
