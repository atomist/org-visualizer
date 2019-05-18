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
import { jsonToQueryString } from "./orgPage";
import { languagesQuery } from "./projectQueries";
import {
    featuresFound,
    necessaryFeaturesNotFound,
    possibleFeaturesNotFound,
} from "./featureQueries";
import { featureManager } from "./features";

export function projectPage(analyzedRepoStore: ProjectAnalysisResultStore): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {
        const exphbs = require("express-handlebars");
        express.engine("handlebars", exphbs({ defaultLayout: "main" }));
        express.set("view engine", "handlebars");

        express.get("/projects/:owner/:repo", ...handlers, async (req, res) => {
            const id = {
                owner: req.params.owner,
                repo: req.params.repo,
                // TODO fix me
                url: undefined,
            };
            const analyzedRepo = await analyzedRepoStore.load(id);

            if (!analyzedRepo) {
                res.render("noProject", {
                    id,
                });
            } else {
                const queryString = jsonToQueryString(req.query);
                const dataUrl = `/projectQueries/${id.owner}/${id.repo}/query?${queryString}`;

                res.render("projectViz", {
                    analysis: analyzedRepo.analysis,
                    timestamp: analyzedRepo.timestamp,
                    name: req.params.owner,
                    ...id,
                    dataUrl,
                    featuresFound: await featuresFound(featureManager, analyzedRepo),
                    possibleFeaturesNotFound: await possibleFeaturesNotFound(featureManager, analyzedRepo),
                    necessaryFeaturesNotFound: await necessaryFeaturesNotFound(featureManager, analyzedRepo),

                });
            }
        });
        express.get("/projectQueries/:owner/:repo/query", ...handlers, async (req, res) => {
            const id = {
                owner: req.params.owner,
                repo: req.params.repo,
                // TODO fix me
                url: undefined,
            };
            const analyzedRepo = await analyzedRepoStore.load(id);
            const data = await languagesQuery.toSunburstTree([analyzedRepo.analysis]);
            res.json(data);
        });
    };
}
