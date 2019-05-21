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
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    featureManager,
    setIdeal,
} from "./features";
import { WellKnownQueries } from "./queries";

import { logger } from "@atomist/automation-client";
import { PossibleIdeals } from "@atomist/sdm-pack-analysis";
import { FP } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import {
    allManagedFingerprints,
    IdealStatus,
    ManagedFingerprints,
    relevantFingerprints,
} from "../feature/FeatureManager";
import { featureQueriesFrom } from "./featureQueries";

// tslint:disable-next-line
const serveStatic = require("serve-static");

/**
 * Add the org page route to Atomist SDM Express server.
 * @param {ProjectAnalysisResultStore} store
 * @return {ExpressCustomizer}
 */
export function orgPage(store: ProjectAnalysisResultStore): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {

        const bodyParser = require("body-parser");
        express.use(bodyParser.json());       // to support JSON-encoded bodies
        express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
            extended: true,
        }));

        const helmet = require("helmet");
        express.use(helmet.frameguard({
            action: "allow-from",
            domain: "https://blog.atomist.com",
        }));

        const exphbs = require("express-handlebars");
        express.engine("handlebars", exphbs({ defaultLayout: "main" }));
        express.set("view engine", "handlebars");
        express.use(serveStatic("public", { index: false }));

        // the org page itself
        express.get("/", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const features = await featureManager.managedFingerprints(repos);

            const actionableFingerprints = allManagedFingerprints(features)
                .filter(mf => mf.variants > features.projectsAnalyzed / 10)
                .sort((a, b) => b.appearsIn - a.appearsIn)
                .sort((a, b) => b.variants - a.variants);

            const importantFeatures = relevantFingerprints(features, fp => fp.variants > 1);

            res.render("home", {
                actionableFingerprints,
                repos,
                features,
                importantFeatures,
            });
        });

        express.get("/organization/:owner", ...handlers, async (req, res) => {
            res.render("org", {
                name: req.params.owner,
            });
        });

        express.get("/projects", ...handlers, async (req, res) => {
            const repos = await store.loadAll();
            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            if (relevantRepos.length === 0) {
                return res.send(`No matching repos for organization ${req.params.owner}`);
            }
            return res.render("projects", {
                repos,
            });
        });

        express.get("/project/:owner/:repo", ...handlers, async (req, res) => {

            const analysis = await store.load({ owner: req.params.owner, repo: req.params.repo, url: "" });

            const allFeatures = await featureManager.managedFingerprints([analysis]);

            const featureStuff = relevantFingerprints(allFeatures, fp => true);

            return res.render("project", {
                owner: req.params.owner,
                repo: req.params.repo,
                features: featureStuff.features,
            });
        });

        express.post("/setIdeal", ...handlers, async (req, res) => {
            logger.info("setting ideal " + JSON.stringify(req.body));
            setIdeal(req.body.fingerprintName, JSON.parse(req.body.stringifiedFP));
            res.send(200);
        });

        express.get("/query", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const featureQueries = featureQueriesFrom(featureManager, repos);
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
            function displayIdeal(ideal: IdealStatus): string | undefined {
                if (ideal === undefined) {
                    return undefined;
                }
                if (ideal === "eliminate") {
                    return "eliminate";
                }
                try {
                    return toDisplayableFingerprint(ideal);
                } catch (err) {
                    logger.error("Could not display fingerprint: " + err);
                    return JSON.stringify(ideal.data);
                }
            }
            const currentIdealForDisplay = displayIdeal(await featureManager.idealResolver(fingerprintName));
            let possibleIdeals: PossibleIdeals<FP> = {};
            if (!currentIdealForDisplay) {
                // TODO: this sucks
                if (feature && feature.suggestIdeal) {
                    possibleIdeals = await feature.suggestIdeal(fingerprintName, []);
                    for (const p of ["world", "local"]) {
                        if (possibleIdeals[p]) {
                            possibleIdeals[p].stringified = JSON.stringify(possibleIdeals[p].ideal);
                            possibleIdeals[p].displayValue = toDisplayableFingerprint(possibleIdeals[p].ideal);
                        }
                    }
                }
            }
            res.render("orgViz", {
                name: req.params.owner,
                dataUrl,
                query: req.params.query,
                fingerprintName,
                fingerprintDisplayName,
                possibleIdeals,
                currentIdeal: currentIdealForDisplay,
            });
        });
        express.get("/query.json", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const featureQueries = featureQueriesFrom(featureManager, repos);
            const allQueries = _.merge(featureQueries, WellKnownQueries);

            const cannedQuery = allQueries[req.query.name]({
                ...req.query,
            });
            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            const data = await cannedQuery.toSunburstTree(relevantRepos);
            res.json(data);
        });
    };
}

export function jsonToQueryString(json: object): string {
    return Object.keys(json).map(key =>
        encodeURIComponent(key) + "=" + encodeURIComponent(json[key]),
    ).join("&");
}
