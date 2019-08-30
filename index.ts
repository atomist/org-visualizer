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

import { Configuration } from "@atomist/automation-client";
import {
    anySatisfied,
    metadata,
    PushImpact,
    ToDefaultBranch,
} from "@atomist/sdm";
import {
    AllGoals,
    configure,
    isInLocalMode,
} from "@atomist/sdm-core";
import {
    aspectSupport,
    commonScorers, DefaultVirtualProjectFinder,
    RepositoryScorer,
    UndesirableUsageChecker,
} from "@atomist/sdm-pack-aspect";
import { sdmConfigClientFactory } from "@atomist/sdm-pack-aspect/lib/analysis/offline/persist/pgClientFactory";
import { PostgresProjectAnalysisResultStore } from "@atomist/sdm-pack-aspect/lib/analysis/offline/persist/PostgresProjectAnalysisResultStore";
import {
    storeFingerprints,
    storeFingerprintsFor,
} from "@atomist/sdm-pack-aspect/lib/aspect/delivery/storeFingerprintsPublisher";
import { Build } from "@atomist/sdm-pack-build";
import { VirtualProjectFinder } from "@atomist/sdm-pack-fingerprints";
import {
    IsMaven,
    mavenBuilder,
    MavenDefaultOptions,
} from "@atomist/sdm-pack-spring";
import { aspects } from "./lib/aspect/aspects";
import { addSuggestedFingerprintCommand } from "./lib/aspect/push/suggestTag";
import { scorers } from "./lib/scorer/scorers";
import {
    combinationTaggers,
    taggers,
} from "./lib/tagger/taggers";
import { demoUndesirableUsageChecker } from "./lib/usage/demoUndesirableUsageChecker";
import { startEmbeddedPostgres } from "./lib/util/postgres";

const virtualProjectFinder: VirtualProjectFinder = DefaultVirtualProjectFinder;

interface TestGoals extends AllGoals {
    build: Build;
    pushImpact: PushImpact;
}

// Use AcceptEverythingUndesirableUsageChecker to disable undesirable usage checking
const undesirableUsageChecker: UndesirableUsageChecker = demoUndesirableUsageChecker;

export const configuration: Configuration = configure<TestGoals>(async sdm => {

        // Create goals that compute fingerprints during delivery
        const pushImpact = new PushImpact();

        const build: Build = new Build()
            .with({
                ...MavenDefaultOptions,
                builder: mavenBuilder(),
            });

        const store = new PostgresProjectAnalysisResultStore(sdmConfigClientFactory(sdm.configuration));
        sdm.addCommand(addSuggestedFingerprintCommand(
            isInLocalMode() ? storeFingerprintsFor(store) : undefined,
        ));

        sdm.addExtensionPacks(
            aspectSupport({
                aspects: aspects(),

                scorers: {
                    all: scorers(undesirableUsageChecker),
                },

                inMemoryScorers: commonScorers.exposeFingerprintScore("all"),

                taggers: taggers({}).concat(combinationTaggers({})),

                goals: {
                    // This enables fingerprints to be computed on push
                    pushImpact,

                    // This enables demonstrating a build aspect
                    build,
                },

                undesirableUsageChecker,
                virtualProjectFinder,

                // In local mode, publish fingerprints to the local PostgreSQL
                // instance, not the Atomist service
                publishFingerprints:
                    isInLocalMode() ? storeFingerprints(store) : undefined,
                instanceMetadata: metadata(),
            }),
        );

        // Return the goals that this SDM will calculate in response to events
        // Add your goals. See the Atomist samples organization at
        // https://github.com/atomist/samples
        return {
            // Fingerprint every push to default branch
            fingerprint: {
                test: ToDefaultBranch,
                goals: pushImpact,
            },
            // We know how to build Maven projects
            build: {
                test: anySatisfied(IsMaven),
                goals: build,
            },
        };
    },
    {
        name: "Org Visualizer",
        preProcessors: [startEmbeddedPostgres],
    });

function consolidatedScorer(name: string): RepositoryScorer {
    return async repo => {
        const found = repo.analysis.fingerprints.find(fp => fp.type === name);
        return !!found ? found.data : undefined;
    };
}
