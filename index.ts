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
import { configureDashboardNotifications } from "@atomist/automation-client-ext-dashboard";
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
import { fingerprintSupport } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { ClientFactory } from "./lib/analysis/offline/persist/pgUtils";
import {
    analyzeGitHubCommandRegistration,
    analyzeLocalCommandRegistration,
} from "./lib/analysis/offline/spider/analyzeCommand";
import {
    CiAspect,
    JavaBuild,
    StackAspect,
} from "./lib/aspect/common/stackAspect";
import { DefaultAspectRegistry } from "./lib/aspect/DefaultAspectRegistry";
import { K8sSpecs } from "./lib/aspect/k8s/spec";
import { NpmDependencies } from "./lib/aspect/node/npmDependencies";
import { TypeScriptVersion } from "./lib/aspect/node/TypeScriptVersion";
import { DirectMavenDependencies } from "./lib/aspect/spring/directMavenDependencies";
import { SpringBootStarter } from "./lib/aspect/spring/springBootStarter";
import { SpringBootVersion } from "./lib/aspect/spring/springBootVersion";
import { TravisScriptsAspect } from "./lib/aspect/travis/travisAspects";
import {
    aspects,
    virtualProjectFinder,
} from "./lib/customize/aspects";
import {
    registerCategories,
    registerReportDetails,
} from "./lib/customize/categories";
import { demoUndesirableUsageChecker } from "./lib/customize/demoUndesirableUsageChecker";
import {
    Scorers,
    scoreWeightings,
} from "./lib/customize/scorers";
import {
    combinationTaggers,
    taggers,
} from "./lib/customize/taggers";
import { CreatePolicyLogOnPullRequest } from "./lib/event/policyLog";
import {
    CreateFingerprintJob,
    CreateFingerprintJobCommand,
} from "./lib/job/createFingerprintJob";
import { calculateFingerprintTask } from "./lib/job/fingerprintTask";
import {
    analysisResultStore,
    createAnalyzer,
    sdmConfigClientFactory,
} from "./lib/machine/machine";
import { api } from "./lib/routes/api";
import { addWebAppRoutes } from "./lib/routes/web-app/webAppRoutes";

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
            NpmDependencies,
            TravisScriptsAspect,
            StackAspect,
            CiAspect,
            JavaBuild,
            SpringBootVersion,
            DirectMavenDependencies,
            K8sSpecs,
            ...optionalAspects,
        ];
        const handlers = [];

        // TODO cd merge into one call
        registerCategories(TypeScriptVersion, "Node.js");
        registerReportDetails(TypeScriptVersion, {
            name: "TypeScript versions",
            shortName: "version",
            unit: "version",
            url: "fingerprint/typescript-version/typescript-version?byOrg=true",
            description: "TypeScript versions in use across all repositories in your workspace, " +
                "broken out by version and repositories that use each version.",
        });
        registerCategories(NpmDependencies, "Node.js");
        registerReportDetails(NpmDependencies, {
            shortName: "dependency",
            unit: "version",
            url: "drift?type=npm-project-deps",
            description: "Node direct dependencies in use across all repositories in your workspace, " +
                "grouped by Drift Level.",
        });
        registerCategories(SpringBootStarter, "Java");
        registerCategories(JavaBuild, "Java");
        registerCategories(SpringBootVersion, "Java");
        registerCategories(DirectMavenDependencies, "Java");
        registerReportDetails(DirectMavenDependencies, {
            shortName: "dependency",
            unit: "version",
            url: "drift?type=maven-direct-dep",
            description: "Maven direct dependencies in use across all repositories in your workspace, " +
                "grouped by Drift Level.",
        });
        if (isStaging) {
            registerCategories(LeinDeps, "Java");
            registerReportDetails(LeinDeps, {
                shortName: "dependency",
                unit: "version",
                url: "drift?type=clojure-project-deps",
                description: "Leiningen direct dependencies in use across all repositories in your workspace, " +
                    "grouped by Drift Level.",
            });
        }
        registerCategories(DockerFrom, "Docker");
        registerReportDetails(DockerFrom, {
            name: "Docker base images",
            shortName: "images",
            unit: "tag",
            url: "fingerprint/docker-base-image/*?byOrg=true&presence=false&progress=false&otherLabel=false&trim=false",
            description: "Docker base images in use across all repositories in your workspace, " +
                "broken out by image label and repositories where used.",
        });
        registerCategories(DockerPorts, "Docker");
        registerReportDetails(DockerPorts, {
            shortName: "ports",
            unit: "port",
            url: "fingerprint/docker-ports/*?byOrg=true&presence=false&progress=false&otherLabel=false&trim=false",
            description: "Ports exposed in Docker configuration in use  across all repositories in your workspace, " +
                "broken out by port number and repositories where used.",
            manage: false,
        });

        if (isInLocalMode()) {
            const analyzer = createAnalyzer(aspects(), virtualProjectFinder);
            sdm.addCommand(analyzeGitHubCommandRegistration(analyzer));
            sdm.addCommand(analyzeLocalCommandRegistration(analyzer));
        }

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
            sdm.addEvent(CreatePolicyLogOnPullRequest);
            sdm.addCommand(CreateFingerprintJobCommand);
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
            configureDashboardNotifications,
            async cfg => {
                const { customizers, routesToSuggestOnStartup } =
                    orgVisualizationEndpoints(
                        sdmConfigClientFactory(cfg),
                        cfg.http.client.factory,
                    );
                cfg.http.customizers.push(...customizers);
                routesToSuggestOnStartup.forEach(rtsos => {
                    cfg.logging.banner.contributors.push(suggestRoute(rtsos));
                });

                // start up embedded postgres if needed
                if (process.env.ATOMIST_POSTGRES === "start" && !_.get(cfg, "sdm.postgres")) {
                    logger.debug("Starting embedded Postgres");
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
        aspects: aspects(),
        undesirableUsageChecker: demoUndesirableUsageChecker,
        scorers: Scorers,
        scoreWeightings,
    })
        .withTaggers(...taggers({}))
        .withCombinationTaggers(...combinationTaggers({}));

    const aboutTheApi = api(resultStore, aspectRegistry);

    if (!isInLocalMode()) {
        return {
            routesToSuggestOnStartup: aboutTheApi.routesToSuggestOnStartup,
            customizers: [aboutTheApi.customizer],
        };
    }

    const aboutStaticPages = addWebAppRoutes(aspectRegistry, resultStore, httpClientFactory);

    return {
        routesToSuggestOnStartup:
            [...aboutStaticPages.routesToSuggestOnStartup,
                ...aboutTheApi.routesToSuggestOnStartup],
        customizers: [aboutStaticPages.customizer, aboutTheApi.customizer],
    };
}
