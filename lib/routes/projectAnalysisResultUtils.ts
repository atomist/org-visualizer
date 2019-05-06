import * as _ from "lodash";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { Renderer } from "../tree/TreeBuilder";

export type ProjectAnalysisResultGrouper = (ar: ProjectAnalysisResult) => string;

export const OrgGrouper: ProjectAnalysisResultGrouper = a => _.get(a, "analysis.id.owner");

export const DefaultProjectAnalysisResultRenderer: Renderer<ProjectAnalysisResult> =
    ar => ({
        name: ar.analysis.id.repo,
        size: 1,
        url: `/projects/${ar.analysis.id.owner}/${ar.analysis.id.repo}`,
        repoUrl: ar.analysis.id.url,
    });
