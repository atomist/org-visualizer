import { Project } from "@atomist/automation-client";
import { Interpretation } from "@atomist/sdm-pack-analysis";

/**
 * Used to query GitHub
 */
export interface ScmSearchCriteria {

    /**
     * Query in GitHub terminology
     */
    githubQueries: string[];

    /**
     * Max number of repos to return
     */
    maxRetrieved: number;

    /**
     * Max number of repos to return
     */
    maxReturned: number;

    /**
     * Are we interested in persisting this project
     * @param {Project} p
     * @return {Promise<boolean>}
     */
    projectTest?: (p: Project) => Promise<boolean>;

    /**
     * Further narrow whether to persist based on interpretation
     * @param {Interpretation} i
     * @return {Promise<boolean>}
     */
    interpretationTest?: (i: Interpretation) => boolean;
}
