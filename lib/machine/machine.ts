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

import { Client } from "pg";

import {
    onAnyPush,
    PushImpact,
    PushImpactListener,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import { createSoftwareDeliveryMachine } from "@atomist/sdm-core";
import {
    analyzerBuilder,
    ProjectAnalyzer,
} from "@atomist/sdm-pack-analysis";
import { circleScanner } from "@atomist/uhura/lib/element/circle/circleScanner";
import { jenkinsScanner } from "@atomist/uhura/lib/element/jenkins/jenkinsScanner";
import { reactScanner } from "@atomist/uhura/lib/element/react/reactScanner";
import { travisScanner } from "@atomist/uhura/lib/element/travis/travisScanner";

import {
    logger,
} from "@atomist/automation-client";
import {
    nodeStackSupport,
} from "@atomist/sdm-pack-analysis-node";
import { DockerScanner } from "@atomist/uhura/lib/element/docker/dockerScanner";
import { gitlabCiScanner } from "@atomist/uhura/lib/element/gitlab-ci/gitlabCiScanner";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { codeMetricsScanner } from "../element/codeMetricsElement";
import { CodeOfConductScanner } from "../element/codeOfConduct";
import { packageLockScanner } from "../element/packageLock";
import {
    featureManager,
    features,
    idealConvergenceScorer,
} from "../routes/features";
import { GitActivityScanner } from "./gitActivityScanner";
import {
    ClientFactory,
    PostgresProjectAnalysisResultStore,
} from "../analysis/offline/persist/PostgresProjectAnalysisResultStore";

/**
 * Add scanners to the analyzer to extract data
 * @param {SoftwareDeliveryMachine} sdm
 * @return {ProjectAnalyzer}
 */
export function createAnalyzer(sdm: SoftwareDeliveryMachine): ProjectAnalyzer {
    return analyzerBuilder(sdm)
        .withScanner(packageLockScanner)
        .withStack(nodeStackSupport(sdm))
        .withFeatures(features)
        .withScanner(GitActivityScanner)
        .withScanner(new DockerScanner())
        .withScanner(travisScanner)
        .withScanner(circleScanner)
        .withScanner(jenkinsScanner)
        .withScanner(gitlabCiScanner)
        .withScanner(reactScanner)
        .withScanner({ action: codeMetricsScanner, runWhen: opts => opts.full })
        .withScanner(CodeOfConductScanner)
        .withScorer(idealConvergenceScorer(featureManager))
        .build();
}

export const clientFactory: ClientFactory = () => new Client({
    database: "org_viz",
});

export const analysisResultStore: ProjectAnalysisResultStore =
    new PostgresProjectAnalysisResultStore(clientFactory);

/**
 * Initialize an sdm definition, and add functionality to it.
 *
 * @param configuration All the configuration for this service
 */
export async function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): Promise<SoftwareDeliveryMachine> {

    const sdm = createSoftwareDeliveryMachine({
        name: "Analysis Software Delivery Machine",
        configuration,
    });

    const analyzer = createAnalyzer(sdm);

    const pushImpact = new PushImpact()
        .withListener(updatedStoredAnalysisIfNecessary({
            analyzedRepoStore: analysisResultStore,
            analyzer,
            maxAgeHours: 1,
        }));
    sdm.withPushRules(
        onAnyPush().setGoals(pushImpact),
    );

    sdm.addCommand({
        name: "count",
        intent: "count analyses",
        listener: async ci => {
            await ci.addressChannels(`There are ${await analysisResultStore.count()} stored analysis results...`);
        },
    });

    return sdm;
}

function updatedStoredAnalysisIfNecessary(opts: {
    analyzedRepoStore: ProjectAnalysisResultStore,
    analyzer: ProjectAnalyzer,
    maxAgeHours: number,
}): PushImpactListener<any> {
    const maxAgeMillis = 60 * 60 * 1000;
    return async pu => {
        try {
            const found = await opts.analyzedRepoStore.loadOne(pu.id);
            const now = new Date();
            if (!found || !found.timestamp || now.getTime() - found.timestamp.getTime() > maxAgeMillis) {
                const analysis = await opts.analyzer.analyze(pu.project, pu, { full: true });
                logger.info("Performing fresh analysis of project at %s", pu.id.url);
                await opts.analyzedRepoStore.persist({
                    analysis,
                    timestamp: now,
                    subproject: found.subproject,
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
