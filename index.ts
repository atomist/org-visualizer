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
    BannerSection,
    Configuration,
    HttpClientFactory,
    logger,
} from "@atomist/automation-client";
import { configureHumio } from "@atomist/automation-client-ext-humio";
import {
    ExpressCustomizer,
    writeUserConfig,
} from "@atomist/automation-client/lib/configuration";
import {
    CachingProjectLoader,
    execPromise,
    GitHubLazyProjectLoader,
    GoalSigningScope,
    PushImpact,
} from "@atomist/sdm";
import {
    configure,
    isInLocalMode,
} from "@atomist/sdm-core";
import { LeinDeps } from "@atomist/sdm-pack-clojure/lib/fingerprints/clojure";
import {
    DockerfilePath,
    DockerFrom,
    DockerPorts,
} from "@atomist/sdm-pack-docker";
import {
    fingerprintSupport,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
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
    const isStaging = sdm.configuration.endpoints.api.includes("staging");

    const optionalAspects = isStaging ? [LeinDeps] : [];

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
        ...optionalAspects,
    ];
    const handlers = [];

    // TODO cd merge into one call
    registerCategories(TypeScriptVersion, "Node.js");
    registerReportDetails(TypeScriptVersion, { url: "fingerprint/typescript-version/typescript-version?byOrg=true" });
    registerCategories(NpmDeps, "Node.js");
    registerReportDetails(NpmDeps, { url: "drift?type=npm-project-deps" });
    registerCategories(SpringBootStarter, "Java");
    registerCategories(JavaBuild, "Java");
    registerCategories(SpringBootVersion, "Java");
    registerCategories(DirectMavenDependencies, "Java");
    registerReportDetails(DirectMavenDependencies, { url: "drift?type=maven-direct-dep" });
    if (isStaging) {
        registerCategories(LeinDeps, "Java");
        registerReportDetails(LeinDeps, { url: "drift?type=clojure-project-deps" });
    }
    registerCategories(DockerFrom, "Docker");
    registerReportDetails(DockerFrom, { url: "filter/aspectReport?type=docker-base-image" });
    registerCategories(DockerPorts, "Docker");
    registerReportDetails(DockerPorts, { url: "filter/aspectReport?type=docker-ports" });

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
                    orgVisualizationEndpoints(
                        sdmConfigClientFactory(cfg),
                        cfg.http.client.factory,
                    );
                cfg.http.customizers = customizers;
                routesToSuggestOnStartup.forEach(rtsos => {
                    cfg.logging.banner.contributors.push(suggestRoute(rtsos));
                });

                // start up embedded postgres if needed
                if (process.env.ATOMIST_POSTGRES === "start" && !_.get(cfg, "sdm.postgres")) {
                    logger.info("Starting embedded Postgres");
                    await execPromise("/etc/init.d/postgresql", ["start"]);

                    const postgresCfg = {
                        user: "org_viz",
                        password: "atomist",
                    };
                    _.set(cfg, "sdm.postgres", postgresCfg);
                    await writeUserConfig({
                        sdm: {
                            postgres: postgresCfg,
                        },
                    });
                }

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

function orgVisualizationEndpoints(dbClientFactory: ClientFactory, httpClientFactory: HttpClientFactory): {
    routesToSuggestOnStartup: Array<{ title: string, route: string }>,
    customizers: ExpressCustomizer[],
} {
    const resultStore = analysisResultStore(dbClientFactory);
    const aspectRegistry = new DefaultAspectRegistry({
        idealStore: resultStore,
        problemStore: resultStore,
        aspects: Aspects,
        undesirableUsageChecker: demoUndesirableUsageChecker,
    });

    const aboutTheApi = api(dbClientFactory, resultStore, aspectRegistry);

    if (!isInLocalMode()) {
        return {
            routesToSuggestOnStartup: aboutTheApi.routesToSuggestOnStartup,
            customizers: [aboutTheApi.customizer],
        };
    }

    const aboutStaticPages = orgPage(aspectRegistry, resultStore, httpClientFactory);

    return {
        routesToSuggestOnStartup:
            [...aboutStaticPages.routesToSuggestOnStartup,
            ...aboutTheApi.routesToSuggestOnStartup],
        customizers: [aboutStaticPages.customizer, aboutTheApi.customizer],
    };
}
