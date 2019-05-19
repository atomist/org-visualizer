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
import { Express, RequestHandler, } from "express";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { featureManager, } from "./features";
import { WellKnownQueries } from "./queries";

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
        const helmet = require("helmet");
        express.use(helmet.frameguard({
            action: "allow-from",
            domain: "https://blog.atomist.com",
        }));
        const exphbs = require("express-handlebars");
        express.engine("handlebars", exphbs({ defaultLayout: "main" }));
        express.set("view engine", "handlebars");
        express.use(serveStatic("public", { index: false }));

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
        express.get("/query", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const featureQueries = featureQueriesFrom(featureManager, repos);
            const allQueries = _.merge(featureQueries, WellKnownQueries);
            const fingerprintName = req.query.name.replace(/-ideal$/, "");

            // TODO: this sucks
            const feature = featureManager.featureFor({ name: fingerprintName } as FP);

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

            function displayIdeal(ideal: IdealStatus): string | undefined {
                if (ideal === undefined) {
                    return undefined;
                }
                if (ideal === "eliminate") {
                    return "eliminate";
                }
                return ideal.data;
            }

            const possibleIdeals: PossibleIdeals<FP> = feature.suggestIdeal ?
                await feature.suggestIdeal(fingerprintName, []) : {};

            const currentIdealForDisplay = displayIdeal(await featureManager.idealResolver(fingerprintName));
            res.render("orgViz", {
                name: req.params.owner,
                dataUrl,
                query: req.params.query,
                fingerprintName,
                possibleIdeals,
                currentIdeal: currentIdealForDisplay,
            });
        });
        express.get("/query.json", ...handlers, async (req, res) => {
            const repos = await store.loadAll();

            const featureQueries = featureQueriesFrom(featureManager, repos);
            const allQueries = _.merge(featureQueries, WellKnownQueries);

            const cannedQuery = allQueries[req.query.name]({
                // name: req.params.name,
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
