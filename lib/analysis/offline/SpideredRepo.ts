import { ProjectAnalysisResult } from "../ProjectAnalysisResult";

/**
 * Spidered repo to persist
 */
export interface SpideredRepo extends ProjectAnalysisResult {

    query: string;

    topics: string[];

    /**
     * Comes from GitHub/wherever
     */
    sourceData: any;

    readme?: string;
}
