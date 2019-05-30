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
    astUtils,
    InMemoryProject,
    InMemoryProjectFile,
} from "@atomist/automation-client";
import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { DeliveryPhases } from "@atomist/sdm-pack-analysis/lib/analysis/phases";
import { DockerFileParser } from "@atomist/sdm-pack-docker";
import {
    CodeStats,
    consolidate,
    Language,
} from "@atomist/sdm-pack-sloc/lib/slocReport";
import { DockerStack } from "@atomist/uhura/lib/element/docker/dockerScanner";
import * as _ from "lodash";
import { CodeMetricsElement } from "../element/codeMetricsElement";
import { PackageLock } from "../element/packageLock";
import {
    Reporters,
} from "../feature/reporters";
import {
    treeBuilder,
    TreeBuilder,
} from "../tree/TreeBuilder";
import {
    DefaultProjectAnalysisRenderer,
    OrgGrouper,
    ProjectAnalysisGrouper,
} from "../feature/support/groupingUtils";
import { Analyzed } from "../feature/FeatureManager";

/**
 * Well known queries against our repo cohort
 */
export const WellKnownQueries: Reporters<ProjectAnalysis> = {

    licenses: params =>
        treeBuilderFor<ProjectAnalysis>("licenses", params)
            .group({
                name: "license",
                by: ar => {
                    if (!ar.elements.node) {
                        return "not npm";
                    }
                    return _.get(ar, "elements.node.packageJson.license", "No license");
                },
            })
            .renderWith(DefaultProjectAnalysisRenderer),

    typeScriptVersions: params =>
        treeBuilderFor("TypeScript versions", params)
            .group({
                name: "version",
                by: ar => _.get(ar, "elements.node.typeScript.version", params.otherLabel),
            })
            .renderWith(DefaultProjectAnalysisRenderer),

    springVersions: params =>
        treeBuilderFor("Spring Boot version", params)
            .group({
                name: "version",
                by: ar => _.get(ar, "elements.node.springboot.version", params.otherLabel),
            })
            .renderWith(DefaultProjectAnalysisRenderer),

    langs: params =>
        treeBuilderFor<ProjectAnalysis>("languages", params)
            .customGroup<CodeStats>({
                name: "language", to: async ars => {
                    const cms: CodeStats[] = [];
                    for await (const ar of ars) {
                        const cm = ar.elements.codemetrics as CodeMetricsElement;
                        if (cm) {
                            cms.push(...cm.languages);
                        }
                    }

                    const distinctLanguages: Language[] = _.uniqBy(_.flatten(cms.map(cm => cm.language)), l => l.name);
                    const s: Record<string, CodeStats[]> = {};
                    distinctLanguages.forEach(lang => s[lang.name] = [consolidate(lang, cms)]);
                    return s;
                },
            })
            .map<ProjectAnalysis & { lang: string }>({
                mapping: async function*(cs: AsyncIterable<CodeStats>, originalQuery: () => AsyncIterable<ProjectAnalysis>) {
                    // TODO don't materialize this
                    const source: ProjectAnalysis[] = [];
                    for await (const pa of originalQuery()) {
                        source.push(pa);
                    }
                    for await (const s of cs) {
                        for (const r of source.filter(ar => {
                            const cm = ar.elements.codemetrics as CodeMetricsElement;
                            return cm.languages.some(l => l.language.name === s.language.name);
                        })
                            .map(ar => ({ ...ar, lang: s.language.name }))) {
                            yield r;
                        }
                    }
                }
            })
            .renderWith(ar => ({
                name: ar.id.repo,
                size: (ar.elements.codemetrics as CodeMetricsElement).languages.find(l => l.language.name === ar.lang).total,
                url: `/projects/${ar.id.owner}/${ar.id.repo}`,
                repoUrl: ar.id.url,
            })),

    // Version of a particular library
    libraryVersions: params =>
        treeBuilderFor<ProjectAnalysis>(`Versions of ${params.artifact}`, params)
            .group({
                name: "version",
                by: ar => {
                    const dep = _.get(ar, "analysis.dependencies", []).find(d => d.artifact === params.artifact);
                    return !!dep ? dep.version : params.otherLabel;
                },
            })
            .group({
                name: "resolved",
                by: ar => {
                    const pl = ar.elements.packageLock as PackageLock;
                    if (!pl) {
                        return params.artifact;
                    }
                    return pl.packageLock.dependencies[params.artifact].version;
                },
            })
            .renderWith(DefaultProjectAnalysisRenderer),

    dependencyCount: params =>
        treeBuilderFor<ProjectAnalysis>("dependency count", params)
            .group({ name: "size", by: groupByDependencyCount })
            .renderWith(ar => {
                const size = ar.dependencies.length;
                return {
                    name: `${ar.id.repo} (${size})`,
                    url: ar.id.url,
                    size,
                };
            }),
    loc: params =>
        treeBuilderFor<ProjectAnalysis>("loc", params)
            .group({ name: "size", by: groupByLoc })
            .split<CodeStats>({
                splitter: ar => {
                    const cm = ar.elements.codemetrics as CodeMetricsElement;
                    return cm.languages;
                },
                namer: a => a.id.repo,
            })
            .renderWith(cs => {
                return {
                    name: `${cs.language.name} (${cs.source})`,
                    // url: ar.analysis.id.url,
                    size: cs.source,
                };
            }),

    docker: params =>
        treeBuilderFor("Docker Y/N", params)
            .group({ name: "docker", by: byDocker })
            .renderWith(DefaultProjectAnalysisRenderer),

    dockerPorts: params =>
        treeBuilderFor<ProjectAnalysis>("Docker ports", params)
            .group({
                name: "docker",
                by: async ar => {
                    const docker = ar.elements.docker as DockerStack;
                    if (!docker || !docker.dockerFile) {
                        return undefined;
                    }
                    const file = new InMemoryProjectFile(docker.dockerFile.path, docker.dockerFile.content);
                    const exposes = await astUtils.findValues(InMemoryProject.of(file), DockerFileParser, "**/Dockerfile",
                        "//EXPOSE");
                    const ports = exposes.map(e => e.replace("EXPOSE ", "")).join(",");
                    return ports || "none";
                },
            })
            .renderWith(DefaultProjectAnalysisRenderer),

    dockerImages: params =>
        treeBuilderFor<ProjectAnalysis>("Docker images", params)
            .group({
                name: "docker",
                by: async ar => {
                    const docker = ar.elements.docker as DockerStack;
                    if (!docker || !docker.dockerFile) {
                        return undefined;
                    }
                    const file = new InMemoryProjectFile(docker.dockerFile.path, docker.dockerFile.content);
                    const images = await astUtils.findValues(InMemoryProject.of(file), DockerFileParser, "**/Dockerfile",
                        "//FROM/image");
                    return images.map(i => i.split(":")[0]).join(",");
                },
            })
            .group({
                name: "version",
                by: async ar => {
                    const docker = ar.elements.docker as DockerStack;
                    if (!docker || !docker.dockerFile) {
                        return undefined;
                    }
                    const file = new InMemoryProjectFile(docker.dockerFile.path, docker.dockerFile.content);
                    const images = await astUtils.findValues(InMemoryProject.of(file), DockerFileParser, "**/Dockerfile",
                        "//FROM/image");
                    return images.map(i => i.split(":")[1]).join(",");
                },
            })
            .renderWith(DefaultProjectAnalysisRenderer),

    uhura: params =>
        treeBuilderFor<ProjectAnalysis>("Uhura readiness", params)
            .group({
                // Group by count of Uhura
                name: "level", by: a => {
                    const ps = _.get(a, "analysis.phaseStatus") as Record<keyof DeliveryPhases, boolean>;
                    if (!ps) {
                        return undefined;
                    }
                    let count = 0;
                    Object.getOwnPropertyNames(ps).forEach(key => {
                        if (ps[key]) {
                            count++;
                        }
                    });
                    return "" + count;
                },
            })
            .group({
                name: "phaseStatus",
                by: a => {
                    const ps = a.phaseStatus;
                    if (!ps) {
                        return undefined;
                    }
                    return Object.getOwnPropertyNames(ps)
                        .filter(k => ps[k])
                        .map(k => k.replace("Goals", ""))
                        .join(",");
                },
            })
            .renderWith(DefaultProjectAnalysisRenderer),

    // Generic path
    path: params =>
        treeBuilderFor(`Path ${params.path}`, params)
            .group({
                name: params.path,
                by: ar => {
                    const raw = _.get(ar, params.path, params.otherLabel);
                    if (!raw) {
                        return raw;
                    }
                    return JSON.stringify(raw);
                },
            })
            .renderWith(DefaultProjectAnalysisRenderer),
};

const byDocker: ProjectAnalysisGrouper = ar => {
    return !!ar.elements.docker ? "Yes" : "No";
};

const groupByLoc: ProjectAnalysisGrouper = ar => {
    const cm = ar.elements.codemetrics as CodeMetricsElement;
    if (!cm) {
        return undefined;
    }
    if (cm.lines > 20000) {
        return "venti";
    }
    if (cm.lines > 8000) {
        return "grande";
    }
    if (cm.lines > 2000) {
        return "tall";
    }
    return "small";
};

const groupByDependencyCount: ProjectAnalysisGrouper = ar => {
    const cm = ar.dependencies.length;
    if (!cm) {
        return undefined;
    }
    if (cm > 100) {
        return "venti";
    }
    if (cm > 50) {
        return "grande";
    }
    if (cm > 15) {
        return "tall";
    }
    return "small";
};

function byElement(list: string[]): ProjectAnalysisGrouper {
    return ar => {
        for (const element of list) {
            if (!!_.get(ar, "elements." + element)) {
                return element;
            }
        }
        return "none";
    };
}

export function treeBuilderFor<A extends Analyzed = Analyzed>(name: string, params: any): TreeBuilder<A, A> {
    const tb = treeBuilder<A>(name);
    return (params.byOrg === "true") ?
        tb.group({ name: "org", by: OrgGrouper }) :
        tb;
}
