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

import { RemoteRepoRef } from "@atomist/automation-client";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { ReportBuilder } from "../tree/TreeBuilder";
import {
    Analyzed,
    HasFingerprints,
} from "./FeatureManager";

/**
 * Options for report generation
 */
export interface ReporterParams {

    /**
     * Do first layer grouping by organization?
     */
    byOrg?: boolean;

    /**
     * Label to use for a non-matching result. If this is set, we show non-matching results,
     * for example when grouping by one of a number of possibilities.
     */
    otherLabel?: string;

    /**
     * Path inside
     */
    path?: string;

    // tODO change to value
    artifact?: string;
}

export type Reporter = (params: ReporterParams) => ReportBuilder<Analyzed>;

/**
 * Reporters we can run against features
 */
export type Reporters<A extends Analyzed = Analyzed> = Record<string, Reporter>;
