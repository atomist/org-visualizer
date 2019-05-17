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
import { huckQueries } from "./huckleberryQueries";
import { NodeStack } from "@atomist/sdm-pack-analysis-node";
import { TypeScriptVersion } from "../huckleberry/TypeScriptVersionFeature";

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
            res.render("home", {});
        });

        express.get("/organization/:owner", ...handlers, async (req, res) => {
            res.render("org", {
                name: req.params.owner,
            });
        });
        express.get("/query/:query", ...handlers, async (req, res) => {
            const repos = await store.loadAll();
            const relevantRepos = repos.filter(ar => req.query.owner ? ar.analysis.id.owner === req.params.owner : true);
            if (relevantRepos.length === 0) {
                return res.send(`No matching repos for organization ${req.params.owner}`);
            }

            const queryString = jsonToQueryString(req.query);
            //WellKnownQueries
            const cannedQueryDefinition = huckQueries[req.params.query];
            if (!cannedQueryDefinition) {
                console.log("Known huck queries = " + Object.getOwnPropertyNames(huckQueries));
                return res.render("noQuery", {
                    query: req.params.query,
                });
            }
            const dataUrl = `/querydata/${req.params.query}?${queryString}`;
            res.render("orgViz", {
                name: req.params.owner,
                dataUrl,
                query: req.params.query,
            });
        });
        express.get("/querydata/:query", ...handlers, async (req, res) => {
            const cannedQuery = huckQueries[req.params.query](req.query);
            const repos = await store.loadAll();
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
