import { RepoId } from "@atomist/automation-client";
import { ProjectAnalysisResult } from "../../ProjectAnalysisResult";

/**
 * Interface for basic persistence operations.
 * Implementations can provide additional querying options,
 * e.g. through SQL.
 */
export interface ProjectAnalysisResultStore {

    /**
     * How many analyses we have stored
     * @return {Promise<number>}
     */
    count(): Promise<number>;

    loadAll(): Promise<ProjectAnalysisResult[]>;

    load(repo: RepoId): Promise<ProjectAnalysisResult | undefined>;

    persist(repos: ProjectAnalysisResult | AsyncIterable<ProjectAnalysisResult> | ProjectAnalysisResult[]): Promise<number>;

}
