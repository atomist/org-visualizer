import { Express, RequestHandler } from "express";
import { RepoForDisplay, RepoList } from "../../../views/repoList";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import { ProjectAnalysisResultStore } from "../../analysis/offline/persist/ProjectAnalysisResultStore";

export function exposeProjectListPage(express: Express,
                                      handlers: RequestHandler[],
                                      store: ProjectAnalysisResultStore): void {
    express.get("/projects", ...handlers, async (req, res) => {
        const workspaceId = req.query.workspace || req.params.workspace_id;
        const allAnalysisResults = await store.loadInWorkspace(workspaceId, false);

        // optional query parameter: owner
        const relevantAnalysisResults = allAnalysisResults.filter(ar => req.query.owner ? ar.analysis.id.owner === req.query.owner : true);
        if (relevantAnalysisResults.length === 0) {
            return res.send(`No matching repos for organization ${req.query.owner}`);
        }

        const reposForDisplay: RepoForDisplay[] = relevantAnalysisResults.map(ar => ({
            url: ar.repoRef.url, repo: ar.repoRef.repo, owner: ar.repoRef.repo, id: ar.id,
        }));
        const virtualProjectCount = await store.virtualProjectCount(workspaceId);
        return res.send(renderStaticReactNode(
            RepoList({ repos: reposForDisplay, virtualProjectCount }),
            "Repository list"));
    });
}
