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
import { DeliveryPhases } from "@atomist/sdm-pack-analysis/lib/analysis/phases";
import { DockerFileParser } from "@atomist/sdm-pack-docker";
import { CodeMetrics } from "@atomist/sdm-pack-sloc";
import {
    CodeStats,
    consolidate,
    Language,
    LanguageStats,
} from "@atomist/sdm-pack-sloc/lib/slocReport";
import { DockerStack } from "@atomist/uhura/lib/element/docker/dockerScanner";
import * as _ from "lodash";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import { CodeMetricsElement } from "../element/codeMetricsElement";
import { PackageLock } from "../element/packageLock";
import {
    SunburstTreeEmitter,
    treeBuilder,
    TreeBuilder,
} from "../tree/TreeBuilder";
import {
    DefaultProjectAnalysisResultRenderer,
    OrgGrouper,
    ProjectAnalysisResultGrouper,
} from "./projectAnalysisResultUtils";

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

/**
 * Well known queries against our repo cohort
 */
export const WellKnownQueries: Queries = {

    licenses: params =>
        treeBuilderFor("licenses", params)
            .group({
                name: "license",
                by: ar => {
                    if (!ar.analysis.elements.node) {
                        return "not npm";
                    }
                    return _.get(ar.analysis, "elements.node.packageJson.license", "No license");
                },
            })
            .renderWith(DefaultProjectAnalysisResultRenderer),

    typeScriptVersions: params =>
        treeBuilderFor("TypeScript versions", params)
            .group({
                name: "version",
                by: ar => _.get(ar.analysis, "elements.node.typeScript.version", params.otherLabel),
            })
            .renderWith(DefaultProjectAnalysisResultRenderer),

    springVersions: params =>
        treeBuilderFor("Spring Boot version", params)
            .group({
                name: "version",
                by: ar => _.get(ar.analysis, "elements.node.springboot.version", params.otherLabel),
            })
            .renderWith(DefaultProjectAnalysisResultRenderer),

    langs: params =>
        treeBuilderFor("languages", params)
            .customGroup<CodeStats>({
                name: "language", to: ars => {
                    const cms: CodeStats[] = _.flatten(ars.map(ar => ar.analysis.elements.codemetrics as CodeMetricsElement)
                        .filter(x => !!x)
                        .map(c => c.languages));
                    const distinctLanguages: Language[] = _.uniqBy(_.flatten(cms.map(cm => cm.language)), l => l.name);
                    const s: Record<string, CodeStats[]> = {};
                    distinctLanguages.forEach(lang => s[lang.name] = [consolidate(lang, cms)]);
                    return s;
                },
            })
            .map<ProjectAnalysisResult & { lang: string }>((cs: CodeStats[], source: ProjectAnalysisResult[]) => {
                return _.flatMap(cs, s => {
                    return source.filter(ar => {
                        const cm = ar.analysis.elements.codemetrics as CodeMetricsElement;
                        return cm.languages.some(l => l.language.name === s.language.name);
                    })
                        .map(ar => ({ ...ar, lang: s.language.name }));
                });
            })
            .renderWith(ar => ({
                name: ar.analysis.id.repo,
                size: (ar.analysis.elements.codemetrics as CodeMetricsElement).languages.find(l => l.language.name === ar.lang).total,
                url: `/projects/${ar.analysis.id.owner}/${ar.analysis.id.repo}`,
                repoUrl: ar.analysis.id.url,
            })),

    // Version of a particular library
    libraryVersions: params =>
        treeBuilderFor(`Versions of ${params.artifact}`, params)
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
                    const pl = ar.analysis.elements.packageLock as PackageLock;
                    if (!pl) {
                        return params.artifact;
                    }
                    return pl.packageLock.dependencies[params.artifact].version;
                },
            })
            .renderWith(DefaultProjectAnalysisResultRenderer),

    dependencyCount: params =>
        treeBuilderFor("dependency count", params)
            .group({ name: "size", by: groupByDependencyCount })
            .renderWith(ar => {
                const size = ar.analysis.dependencies.length;
                return {
                    name: `${ar.analysis.id.repo} (${size})`,
                    url: ar.analysis.id.url,
                    size,
                };
            }),
    loc: params =>
        treeBuilderFor("loc", params)
            .group({ name: "size", by: groupByLoc })
            .split<CodeStats>({
                splitter: ar => {
                    const cm = ar.analysis.elements.codemetrics as CodeMetricsElement;
                    return cm.languages;
                },
                namer: a => a.analysis.id.repo,
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
            .renderWith(DefaultProjectAnalysisResultRenderer),

    dockerPorts: params =>
        treeBuilderFor("Docker ports", params)
            .group({
                name: "docker",
                by: async ar => {
                    const docker = ar.analysis.elements.docker as DockerStack;
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
            .renderWith(DefaultProjectAnalysisResultRenderer),

    dockerImages: params =>
        treeBuilderFor("Docker images", params)
            .group({
                name: "docker",
                by: async ar => {
                    const docker = ar.analysis.elements.docker as DockerStack;
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
                    const docker = ar.analysis.elements.docker as DockerStack;
                    if (!docker || !docker.dockerFile) {
                        return undefined;
                    }
                    const file = new InMemoryProjectFile(docker.dockerFile.path, docker.dockerFile.content);
                    const images = await astUtils.findValues(InMemoryProject.of(file), DockerFileParser, "**/Dockerfile",
                        "//FROM/image");
                    return images.map(i => i.split(":")[1]).join(",");
                },
            })
            .renderWith(DefaultProjectAnalysisResultRenderer),

    // TODO classifies only one or other. Should have a hierarchy of choices?
    using: params =>
        treeBuilderFor("Docker Y/N", params)
            .group({ name: "docker", by: byElement(params.list.split(",")) })
            .renderWith(DefaultProjectAnalysisResultRenderer),

    uhura: params =>
        treeBuilderFor("Uhura readiness", params)
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
                    const ps = a.analysis.phaseStatus;
                    if (!ps) {
                        return undefined;
                    }
                    return Object.getOwnPropertyNames(ps)
                        .filter(k => ps[k])
                        .map(k => k.replace("Goals", ""))
                        .join(",");
                },
            })
            .renderWith(DefaultProjectAnalysisResultRenderer),

    // Generic path
    path: params =>
        treeBuilderFor(`Path ${params.path}`, params)
            .group({
                name: params.path,
                by: ar => {
                    const raw = _.get(ar.analysis, params.path, params.otherLabel);
                    if (!raw) {
                        return raw;
                    }
                    return JSON.stringify(raw);
                },
            })
            .renderWith(DefaultProjectAnalysisResultRenderer),
};

const byDocker: ProjectAnalysisResultGrouper = ar => {
    return !!ar.analysis.elements.docker ? "Yes" : "No";
};

const groupByLoc: ProjectAnalysisResultGrouper = ar => {
    const cm = ar.analysis.elements.codemetrics as CodeMetricsElement;
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

const groupByDependencyCount: ProjectAnalysisResultGrouper = ar => {
    const cm = ar.analysis.dependencies.length;
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

function byElement(list: string[]): ProjectAnalysisResultGrouper {
    return ar => {
        for (const element of list) {
            if (!!_.get(ar.analysis, "elements." + element)) {
                return element;
            }
        }
        return "none";
    };
}

export function treeBuilderFor(name: string, params: any): TreeBuilder<ProjectAnalysisResult, ProjectAnalysisResult> {
    const tb = treeBuilder<ProjectAnalysisResult>(name);
    return (params.byOrg === "true") ?
        tb.group({ name: "org", by: OrgGrouper }) :
        tb;
}
