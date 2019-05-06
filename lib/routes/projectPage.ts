import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import { Express, RequestHandler } from "express";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { jsonToQueryString } from "./orgPage";
import { languagesQuery } from "./projectQueries";

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
