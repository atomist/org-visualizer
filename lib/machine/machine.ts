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

import {
    Configuration,
    logger,
} from "@atomist/automation-client";
import { PushImpactListener } from "@atomist/sdm";
import * as _ from "lodash";
import { Pool } from "pg";
import { ClientFactory } from "../analysis/offline/persist/pgUtils";
import { PostgresProjectAnalysisResultStore } from "../analysis/offline/persist/PostgresProjectAnalysisResultStore";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { Analyzer } from "../analysis/offline/spider/Spider";
import { SpiderAnalyzer } from "../analysis/offline/spider/SpiderAnalyzer";
import { ManagedAspect } from "../aspect/AspectRegistry";
import { IdealStore } from "../aspect/IdealStore";
import { ProblemStore } from "../aspect/ProblemStore";

/**
 * Add scanners to the analyzer to extract data
 * @return {ProjectAnalyzer}
 */
export function createAnalyzer(aspects: ManagedAspect[]): Analyzer {
    return new SpiderAnalyzer(aspects);
}

const PoolHolder: { pool: Pool } = { pool: undefined };

export function sdmConfigClientFactory(config: Configuration): ClientFactory {
    if (!PoolHolder.pool) {
        PoolHolder.pool = new Pool({
            database: "org_viz",
            ...(_.get(config, "sdm.postgres") || {}),
        });
    }
    return () => PoolHolder.pool.connect();
}

export function analysisResultStore(factory: ClientFactory): ProjectAnalysisResultStore & IdealStore & ProblemStore {
    return new PostgresProjectAnalysisResultStore(factory);
}

export function updatedStoredAnalysisIfNecessary(opts: {
    analyzedRepoStore: ProjectAnalysisResultStore,
    analyzer: Analyzer,
    maxAgeHours: number,
}): PushImpactListener<any> {
    const maxAgeMillis = 60 * 60 * 1000;
    return async pu => {
        try {
            const found = await opts.analyzedRepoStore.loadByRepoRef(pu.id, false);
            const now = new Date();
            if (!found || !found.timestamp || now.getTime() - found.timestamp.getTime() > maxAgeMillis) {
                const analysis = await opts.analyzer.analyze(pu.project);
                logger.debug("Performing fresh analysis of project at %s", pu.id.url);
                await opts.analyzedRepoStore.persist({
                    repoRef: analysis.id,
                    analysis,
                    timestamp: now,
                    workspaceId: pu.context.workspaceId,
                });
            } else {
                logger.info("Stored analysis of project at %s is up to date", pu.id.url);
            }
        } catch (err) {
            // Never fail
            logger.warn(err);
        }
    };
}
