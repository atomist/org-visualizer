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

import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { DeliveryPhases } from "@atomist/sdm-pack-analysis/lib/analysis/phases";
import {
    BaseFeature,
    FP,
    NpmDeps,
} from "@atomist/sdm-pack-fingerprints";
import {
    CodeStats,
    consolidate,
    Language,
} from "@atomist/sdm-pack-sloc/lib/slocReport";
import * as _ from "lodash";
import * as path from "path";
import { FingerprintUsage } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { CodeMetricsElement } from "../element/codeMetricsElement";
import { PackageLock } from "../element/packageLock";
import {
    Analyzed,
    AspectRegistry,
} from "../feature/AspectRegistry";
import { fingerprintsFrom } from "../feature/DefaultFeatureManager";
import { Reporters } from "../feature/reporters";
import { allMavenDependenciesFeature } from "../feature/spring/allMavenDependenciesFeature";
import {
    AnalyzedGrouper,
    defaultAnalyzedRenderer,
    OrgGrouper,
    ProjectAnalysisGrouper,
} from "../feature/support/groupingUtils";
import {
    ReportBuilder,
    treeBuilder,
    TreeBuilder,
} from "../tree/TreeBuilder";

/**
 * Well known reporters against our repo cohort.
 * Works against full analyses.
 */
export const WellKnownReporters: Reporters = {

        fileCount: params =>
            treeBuilderFor<Analyzed>("fileCount", params)
                .renderWith(ar => {
                    const sizeFp = ar.fingerprints.find(fp => fp.name === "size");
                    const size = sizeFp ? parseInt(sizeFp.data, 10) : 1;
                    const projectName = ar.id.path ?
                        ar.id.repo + path.sep + ar.id.path :
                        ar.id.repo;
                    const url = ar.id.path ?
                        ar.id.url + "/tree/" + (ar.id.sha || "master") + "/" + ar.id.path :
                        ar.id.url;

                    return {
                        name: projectName,
                        size,
                        url,
                        repoUrl: ar.id.url,
                    };
                }),

        // TODO this could be more generic for sized things
        branchCount: params =>
            treeBuilderFor<Analyzed>("branchCount", params)
                .renderWith(ar => {
                    const sizeFp = ar.fingerprints.find(fp => fp.name === "branches");
                    const size = sizeFp ? parseInt(sizeFp.data, 10) : 1;
                    const projectName = ar.id.path ?
                        ar.id.repo + path.sep + ar.id.path :
                        ar.id.repo;
                    const url = ar.id.path ?
                        ar.id.url + "/tree/" + (ar.id.sha || "master") + "/" + ar.id.path :
                        ar.id.url;

                    return {
                        name: projectName,
                        size,
                        url,
                        repoUrl: ar.id.url,
                    };
                }),

        skew: () => {
            return {
                toSunburstTree: async originalQuery => {
                    const fingerprints: FP[] = [];
                    for await (const fp of fingerprintsFrom(originalQuery())) {
                        if (!fingerprints.some(f => f.sha === fp.sha)) {
                            fingerprints.push(fp);
                        }
                    }
                    const grouped = _.groupBy(fingerprints, fp => fp.type);

                    return {
                        name: "skew",
                        children: Object.getOwnPropertyNames(grouped).map(name => {
                            return {
                                name,
                                children: grouped[name].map(g => {
                                    return {
                                        name: g.name,
                                        size: 1,
                                    };
                                }),
                            };
                        }),
                    };
                },
            };
        },

        typeScriptVersions:
            params =>
                treeBuilderFor("TypeScript versions", params)
                    .group({
                        name: "version",
                        by: ar => _.get(ar, "elements.node.typeScript.version", params.otherLabel),
                    })
                    .renderWith(defaultAnalyzedRenderer()),

        springVersions: params =>
            treeBuilderFor("Spring Boot version", params)
                .group({
                    name: "version",
                    by: ar => _.get(ar, "elements.node.springboot.version", params.otherLabel),
                })
                .renderWith(defaultAnalyzedRenderer()),

        langs:
            params =>
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
                        async* mapping(cs: AsyncIterable<CodeStats>, originalQuery: () => AsyncIterable<ProjectAnalysis>) {
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
                        },
                    })
                    .renderWith(ar => ({
                        name: ar.id.repo,
                        size: (ar.elements.codemetrics as CodeMetricsElement).languages.find(l => l.language.name === ar.lang).total,
                        url: `/projects/${ar.id.owner}/${ar.id.repo}`,
                        repoUrl: ar.id.url,
                    })),

        // Version of a particular library
        libraryVersions:
            params =>
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
                    .renderWith(defaultAnalyzedRenderer()),

        npmDependencyCount:
            params => featureGroup("Maven dependency count", params, NpmDeps),

        mavenDependencyCount:
            params => featureGroup("Maven dependency count", params, allMavenDependenciesFeature),

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

        // Features found in this project
        featureCount: params =>
            treeBuilderFor("featureCount", params)
                .renderWith(ar => {
                    // TODO fix this using new support
                    const rendered = defaultAnalyzedRenderer()(ar);
                    rendered.size = _.uniq(ar.fingerprints.map(fp => fp.type)).length;
                    return rendered;
                }),

        uhura:
            params =>
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
                    .renderWith(defaultAnalyzedRenderer()),

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
                        return typeof raw === "string" ? raw : JSON.stringify(raw);
                    },
                })
                .renderWith(defaultAnalyzedRenderer()),
    }
;

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

function featureGroup(name: string, params: any, feature: BaseFeature) {
    return treeBuilderFor<ProjectAnalysis>(name, params)
        .group({ name: "size", by: groupByFingerprintCount(feature) })
        .renderWith(ar => {
            const size = ar.fingerprints.filter(fp => feature.name === (fp.type || fp.name)).length;
            return {
                name: `${ar.id.repo} (${size})`,
                url: ar.id.url,
                size,
            };
        });
}

/**
 * Group by the number of fingerprints from this feature
 * @param {BaseFeature} feature
 * @return {AnalyzedGrouper}
 */
function groupByFingerprintCount(feature: BaseFeature): AnalyzedGrouper {
    return ar => {
        const cm = ar.fingerprints.filter(fp => feature.name === (fp.type || fp.name)).length;
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
}

export function treeBuilderFor<A extends Analyzed = Analyzed>(name: string, params: any): TreeBuilder<A, A> {
    const tb = treeBuilder<A>(name);
    return (params.byOrg === "true") ?
        tb.group({ name: "org", by: OrgGrouper }) :
        tb;
}

export function skewReport(fm: AspectRegistry): ReportBuilder<FingerprintUsage> {
    return treeBuilder<FingerprintUsage>("entropy")
        .group({
            name: "entropy-band",
            by: fp => {
                if (fp.entropy > 2) {
                    return "random (>2)";
                }
                if (fp.entropy > 1) {
                    return "wild (>1)";
                }
                if (fp.entropy > .5) {
                    return "loose (>.5)";
                }
                return undefined;
            },
        })
        .group({
            name: "type",
            by: fp => {
                // Suppress features without display names
                const feature = fm.aspectOf(fp.type);
                return !!feature && feature.displayName ?
                    feature.displayName :
                    undefined;
            },
        })
        .renderWith(fp => {
            return {
                name: `${fp.name} (${fp.entropy})`,
                size: fp.variants,
            };
        });
}

/**
 * Report on all fingerprints of a particular type
 */
export function featureReport(type: string, fm: AspectRegistry, allMatching: FP[]): ReportBuilder<FP> {
    return treeBuilder<FP>(type)
        .group({
            name: "name",
            by: fp => fp.type === type ? fp.name : undefined,
        })
        .renderWith(fp => {
            const feature = fm.aspectOf(fp.type);
            return {
                name: feature ? feature.toDisplayableFingerprint(fp) : JSON.stringify(fp.data),
                size: allMatching.filter(a => fp.sha === a.sha).length,
            };
        });
}
