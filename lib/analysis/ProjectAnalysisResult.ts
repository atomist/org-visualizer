import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";

/**
 * The result of running one analysis. Allows us to attach further information,
 * such as provenance if we spidered it.
 */
export interface ProjectAnalysisResult {

    analysis: ProjectAnalysis;

    /**
     * Date of this analysis
     */
    timestamp: Date;

}

export function isProjectAnalysisResult(r: any): r is ProjectAnalysisResult {
    const maybe = r as ProjectAnalysisResult;
    return !!maybe.analysis;
}
