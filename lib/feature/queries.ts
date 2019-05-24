import { SunburstTreeEmitter } from "../tree/TreeBuilder";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

export interface QueryParams {

    byOrg?: boolean;

    otherLabel?: string;

    /**
     * Path inside
     */
    path?: string;

    // tODO change to value
    artifact?: string;

    // TODO get rid of it
    list?: string;
}

export type Queries = Record<string, (params: QueryParams) => SunburstTreeEmitter<ProjectAnalysisResult>>;
