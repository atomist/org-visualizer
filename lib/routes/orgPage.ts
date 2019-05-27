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
import * as ReactDOMServer from "react-dom/server";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    featureManager,
    setIdeal,
} from "./features";
import { WellKnownQueries } from "./wellKnownQueries";

import { logger } from "@atomist/automation-client";
import {
    FP,
    PossibleIdeal,
} from "@atomist/sdm-pack-fingerprints";
import * as bodyParser from "body-parser";
import * as _ from "lodash";
import { CSSProperties, ReactElement } from "react";
import serveStatic = require("serve-static");
import { OrgExplorer } from "../../views/org";
import { FeatureForDisplay, FingerprintForDisplay, ProjectExplorer } from "../../views/project";
import {
    ProjectForDisplay,
    ProjectList,
} from "../../views/projectList";
import {
    PossibleIdealForDisplay,
    SunburstQuery,
} from "../../views/sunburstQuery";
import { TopLevelPage } from "../../views/topLevelPage";
import { MelbaFingerprintForDisplay } from "../feature/DefaultFeatureManager";
import { ManagedFeature } from "../feature/FeatureManager";
import { featureQueriesFrom } from "../feature/featureQueries";
import {
    allManagedFingerprints,
    relevantFingerprints,
} from "../feature/support/featureUtils";

function renderStaticReactNode(body: ReactElement,
    title?: string,
    extraScripts?: string[]): string {
    return ReactDOMServer.renderToStaticMarkup(
        TopLevelPage({
            bodyContent: body,
            pageTitle: title,
            extraScripts,
        })); // I don't know why the types don't agree, but it works
}
/**
 * Add the org page route to Atomist SDM Express server.
 * @param {ProjectAnalysisResultStore} store
 * @return {ExpressCustomizer}
 */
export function orgPage(store: ProjectAnalysisResultStore): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {

        express.use(bodyParser.json());       // to support JSON-encoded bodies
        express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
            extended: true,
        }));

        const exphbs = require("express-handlebars");
        express.engine("handlebars", exphbs({ defaultLayout: "main" }));
        express.set("view engine", "handlebars");
        express.use(serveStatic("public", { index: false }));

        /* redirect / to the org page. This way we can go right here
         * for now, and later make a higher-level page if we want.
         */
        express.get("/", ...handlers, async (req, res) => {
            res.redirect("/org");
        });
        // the org page itself
        express.get("/org", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const features = await featureManager.managedFingerprints(repos.map(r => r.analysis));

            const actionableFingerprints = allManagedFingerprints(features)
                .filter(mf => mf.variants > features.projectsAnalyzed / 10)
                .sort((a, b) => b.appearsIn - a.appearsIn)
                .sort((a, b) => b.variants - a.variants);

            const importantFeatures = relevantFingerprints(features, fp => fp.variants > 1);

            res.send(renderStaticReactNode(OrgExplorer({
                actionableFingerprints,
                repos,
                features,
                importantFeatures,
            } as any)));
        });

        express.get("/organization/:owner", ...handlers, async (req, res) => {
            res.render("org", {
                name: req.params.owner,
            });
        });

        express.get("/projects", ...handlers, async (req, res) => {
            const allAnalysisResults = await store.loadAll();

            // optional query parameter: owner
            const relevantAnalysisResults = allAnalysisResults.filter(ar => req.query.owner ? ar.analysis.id.owner === req.query.owner : true);
            if (relevantAnalysisResults.length === 0) {
                return res.send(`No matching repos for organization ${req.query.owner}`);
            }

            const projectsForDisplay: ProjectForDisplay[] = relevantAnalysisResults.map(ar => ar.analysis.id);

            return res.send(renderStaticReactNode(
                ProjectList({ projects: projectsForDisplay }),
                "Project list"));
        });

        express.get("/project/:owner/:repo", ...handlers, async (req, res) => {

            const analysis = await store.load({ owner: req.params.owner, repo: req.params.repo, url: "" });

            const featuresAndFingerprints = await featureManager.projectFingerprints(analysis);

            // assign style based on ideal
            const yay: FeatureForDisplay[] = featuresAndFingerprints.map(featureAndFingerprints => ({
                ...featureAndFingerprints,
                fingerprints: featureAndFingerprints.fingerprints.map(fp => ({
                    ...fp,
                    idealDisplayString: displayIdeal(fp, featureAndFingerprints.feature),
                    style: displayStyleAccordingToIdeal(fp),
                })),
            }));

            return res.send(renderStaticReactNode(ProjectExplorer({
                owner: req.params.owner,
                repo: req.params.repo,
                features: yay,
            })));
        });

        express.post("/setIdeal", ...handlers, async (req, res) => {
            logger.info("setting ideal " + JSON.stringify(req.body));
            setIdeal(req.body.fingerprintName, JSON.parse(req.body.stringifiedFP));
            res.send(200);
        });

        express.get("/query", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const featureQueries = featureQueriesFrom(featureManager, repos.map(r => r.analysis));
            const allQueries = _.merge(featureQueries, WellKnownQueries);
            const fingerprintName = req.query.name.replace(/-ideal$/, "");

            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            if (relevantRepos.length === 0) {
                return res.send(`No matching repos for organization ${req.params.owner}`);
            }

            const queryString = jsonToQueryString(req.query);
            const cannedQueryDefinition = allQueries[req.query.name];
            if (!cannedQueryDefinition) {
                return res.render("noQuery", {
                    query: req.query.name,
                });
            }
            const dataUrl = `/query.json?${queryString}`;

            const feature = featureManager.featureFor({ name: fingerprintName } as FP);
            const fingerprintDisplayName = (feature && feature.toDisplayableFingerprintName) ?
                feature.toDisplayableFingerprintName(fingerprintName) :
                fingerprintName;

            const toDisplayableFingerprint = (feature && feature.toDisplayableFingerprint) || (fp => fp.data);
            function displayIdeal(ideal: PossibleIdeal): string | undefined {
                if (ideal === undefined) {
                    return undefined;
                }
                if (ideal.ideal === undefined) {
                    return "eliminate";
                }
                try {
                    return toDisplayableFingerprint(ideal.ideal);
                } catch (err) {
                    logger.error("Could not display fingerprint: " + err);
                    return JSON.stringify(ideal.ideal.data);
                }
            }
            const currentIdealForDisplay = displayIdeal(await featureManager.idealResolver(fingerprintName));
            const possibleIdealsForDisplay: PossibleIdealForDisplay[] = [];
            if (!currentIdealForDisplay) {
                // TODO: this sucks
                if (feature && feature.suggestedIdeals) {
                    const possibleIdeals = await feature.suggestedIdeals(fingerprintName);
                    for (const ideal of possibleIdeals) {
                        possibleIdealsForDisplay.push({
                            ...ideal,
                            displayValue: toDisplayableFingerprint(ideal.ideal),
                            stringified: JSON.stringify(ideal),
                        });
                    }
                }
            }
            res.send(renderStaticReactNode(
                SunburstQuery({
                    fingerprintDisplayName,
                    currentIdeal: currentIdealForDisplay,
                    possibleIdeals: possibleIdealsForDisplay,
                    query: req.params.query,
                    dataUrl,
                }),
                fingerprintDisplayName,
                ["https://d3js.org/d3.v4.min.js", "/js/sunburst.js"]));
            // res.render("orgViz", {
            //     name: req.params.owner,
            //     dataUrl,
            //     query: req.params.query,
            //     fingerprintName,
            //     fingerprintDisplayName,
            //     possibleIdeals,
            //     currentIdeal: currentIdealForDisplay,
            // });
        });

        express.get("/query.json", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const featureQueries = featureQueriesFrom(featureManager, repos.map(r => r.analysis));
            const allQueries = _.merge(featureQueries, WellKnownQueries);

            const cannedQuery = allQueries[req.query.name]({
                ...req.query,
            });
            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            //  console.log("Build tree from " + relevantRepos.length);
            const data = await cannedQuery.toSunburstTree(relevantRepos.map(r => r.analysis));
            res.json(data);
        });
    };
}

export function jsonToQueryString(json: object): string {
    return Object.keys(json).map(key =>
        encodeURIComponent(key) + "=" + encodeURIComponent(json[key]),
    ).join("&");
}

function displayIdeal(fingerprint: MelbaFingerprintForDisplay, feature: ManagedFeature): string {
    if (idealIsDifferentFromActual(fingerprint)) {
        const toDisplayableFingerprint = feature.toDisplayableFingerprint || (ffff => ffff.data);
        return toDisplayableFingerprint(fingerprint.ideal.ideal);
    }
    if (idealIsElimination(fingerprint)) {
        return "eliminate";
    }
    return "";
}

function idealIsElimination(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && fingerprint.ideal.ideal === undefined;
}

function idealIsDifferentFromActual(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && fingerprint.ideal.ideal !== undefined && fingerprint.ideal.ideal.sha !== fingerprint.sha;
}

function idealIsSameAsActual(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && fingerprint.ideal.ideal !== undefined && fingerprint.ideal.ideal.sha === fingerprint.sha;
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
