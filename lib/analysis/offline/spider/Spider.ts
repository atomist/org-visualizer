import { ProjectAnalyzer } from "@atomist/sdm-pack-analysis";
import { ProjectAnalysisResult } from "../../ProjectAnalysisResult";
import { ProjectAnalysisResultStore } from "../persist/ProjectAnalysisResultStore";
import { SpideredRepo } from "../SpideredRepo";
import { ScmSearchCriteria } from "./ScmSearchCriteria";

export type ProjectAnalysisResultFilter = (pa: ProjectAnalysisResult) => Promise<boolean>;

/**
 * Options for spidering source code hosts
 */
export interface SpiderOptions {

    persister: ProjectAnalysisResultStore;

    poolSize: number;

    /**
     * Is this record OK or should it be refreshed?
     */
    keepExistingPersisted: ProjectAnalysisResultFilter;

    /**
     * Invoked after the repo is persisted to perform any additional actions.
     */
    onPersisted?: (repo: SpideredRepo) => Promise<void>;
}

/**
 * Spider a data source and progressively persist what we find.
 */
export interface Spider {

    spider(criteria: ScmSearchCriteria,
           analyzer: ProjectAnalyzer,
           opts: SpiderOptions): Promise<number>;
}
