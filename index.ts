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

import { BannerSection, Configuration } from "@atomist/automation-client";
import { configureHumio } from "@atomist/automation-client-ext-humio";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import {
    CachingProjectLoader,
    GitHubLazyProjectLoader,
    GoalSigningScope,
    PushImpact,
} from "@atomist/sdm";
import { configure } from "@atomist/sdm-core";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    fingerprintSupport,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import { ClientFactory } from "./lib/analysis/offline/persist/pgUtils";
import {
    CiAspect,
    JavaBuild,
    StackAspect,
} from "./lib/aspect/common/stackAspect";
import { DefaultAspectRegistry } from "./lib/aspect/DefaultAspectRegistry";
import { TypeScriptVersion } from "./lib/aspect/node/TypeScriptVersion";
import { DirectMavenDependencies } from "./lib/aspect/spring/directMavenDependencies";
import { SpringBootStarter } from "./lib/aspect/spring/springBootStarter";
import { SpringBootVersion } from "./lib/aspect/spring/springBootVersion";
import { TravisScriptsAspect } from "./lib/aspect/travis/travisAspects";
import { Aspects } from "./lib/customize/aspects";
import {
    registerCategories,
    registerReportDetails,
} from "./lib/customize/categories";
import { demoUndesirableUsageChecker } from "./lib/customize/demoUndesirableUsageChecker";
import { CreateFingerprintJob } from "./lib/job/createFingerprintJob";
import { calculateFingerprintTask } from "./lib/job/fingerprintTask";
import {
    analysisResultStore,
    sdmConfigClientFactory,
} from "./lib/machine/machine";
import { api } from "./lib/routes/api";
import { orgPage } from "./lib/routes/orgPage";

// Mode can be online or mode
const mode = process.env.ATOMIST_ORG_VISUALIZER_MODE || "online";

export const configuration: Configuration = configure(async sdm => {

    const jobAspects = [
        DockerFrom,
        DockerfilePath,
        DockerPorts,
        SpringBootStarter,
        TypeScriptVersion,
        NpmDeps,
        TravisScriptsAspect,
        StackAspect,
        CiAspect,
        JavaBuild,
        SpringBootVersion,
        DirectMavenDependencies,
    ];
    const handlers = [];

    // TODO cd merge into one call
    registerCategories(TypeScriptVersion, "Node.js");
    registerReportDetails(TypeScriptVersion, { url: "fingerprint/typescript-version/typescript-version?byOrg=true" });
    registerCategories(NpmDeps, "Node.js");
    registerReportDetails(NpmDeps);
    registerCategories(SpringBootStarter, "Java");
    registerReportDetails(SpringBootStarter);
    registerCategories(JavaBuild, "Java");
    registerReportDetails(JavaBuild);
    registerCategories(SpringBootVersion, "Java");
    registerReportDetails(SpringBootVersion);
    registerCategories(DirectMavenDependencies, "Java");
    registerReportDetails(DirectMavenDependencies);
    registerCategories(DockerFrom, "Docker");
    registerReportDetails(DockerFrom);
    registerCategories(DockerfilePath, "Docker");
    registerReportDetails(DockerfilePath);
    registerCategories(DockerPorts, "Docker");
    registerReportDetails(DockerPorts);

    if (mode === "online") {
        const pushImpact = new PushImpact();

        sdm.addExtensionPacks(
            fingerprintSupport({
                pushImpactGoal: pushImpact,
                aspects: jobAspects,
                handlers,
            }));

        return {
            analyze: {
                goals: pushImpact,
            },
        };
    } else {
        sdm.addEvent(CreateFingerprintJob);
        sdm.addCommand(calculateFingerprintTask(jobAspects, handlers));
        return {};
    }

},
    {
        name: "Analysis Software Delivery Machine",
        preProcessors: async cfg => {

            // Do not surface the single pushImpact goal set in every UI
            cfg.sdm.tagGoalSet = async () => [{ name: "@atomist/sdm/internal" }];
            // Use lazy project loader for this SDM
            cfg.sdm.projectLoader = new GitHubLazyProjectLoader(new CachingProjectLoader());
            // Disable goal hooks from repos
            cfg.sdm.goal = {
                hooks: false,
            };
            // For safety we sign every goal
            cfg.sdm.goalSigning = {
                ...cfg.sdm.goalSigning,
                scope: GoalSigningScope.All,
            };

            if (mode === "job") {
                cfg.name = `${cfg.name}-job`;
                cfg.ws.termination = {
                    graceful: true,
                    gracePeriod: 1000 * 60 * 10,
                };
            }

            return cfg;
        },

        postProcessors: [
            configureHumio,
            async cfg => {
                const { customizers, routesToSuggestOnStartup } =
                    orgVisualizationEndpoints(sdmConfigClientFactory(cfg));
                cfg.http.customizers = customizers;
                routesToSuggestOnStartup.forEach(rtsos => {
                    cfg.logging.banner.contributors.push(suggestRoute(rtsos));
                });
                return cfg;
            },
        ],
    });

function suggestRoute({ title, route }: { title: string, route: string }):
    (c: Configuration) => BannerSection {
    return cfg => ({
        title,
        body: `http://localhost:${cfg.http.port}${route}`,
    });
}

function orgVisualizationEndpoints(clientFactory: ClientFactory): {
    routesToSuggestOnStartup: Array<{ title: string, route: string }>,
    customizers: ExpressCustomizer[],
} {
    const resultStore = analysisResultStore(clientFactory);
    const aspectRegistry = new DefaultAspectRegistry({
        idealStore: resultStore,
        aspects: Aspects,
        undesirableUsageChecker: demoUndesirableUsageChecker,
    });

    const aboutTheApi = api(clientFactory, resultStore, aspectRegistry);

    if (["production", "testing"].includes(process.env.NODE_ENV)) {
        return {
            routesToSuggestOnStartup: aboutTheApi.routesToSuggestOnStartup,
            customizers: [aboutTheApi.customizer],
        };
    }

    const aboutStaticPages = orgPage(aspectRegistry, resultStore);

    return {
        routesToSuggestOnStartup:
            [...aboutStaticPages.routesToSuggestOnStartup,
            ...aboutTheApi.routesToSuggestOnStartup],
        customizers: [aboutStaticPages.customizer, aboutTheApi.customizer],
    };
}
