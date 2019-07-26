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
import {
    BaseAspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import {
    CodeStats,
    consolidate,
    Language,
} from "@atomist/sdm-pack-sloc/lib/slocReport";
import * as _ from "lodash";
import * as path from "path";
import {
    Analyzed,
    AspectRegistry,
} from "../aspect/AspectRegistry";
import { Reporters } from "../aspect/reporters";
import {
    AnalyzedGrouper,
    defaultAnalyzedRenderer,
    OrgGrouper,
    ProjectAnalysisGrouper,
} from "../aspect/support/groupingUtils";
import { CodeMetricsElement } from "../element/codeMetricsElement";
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
                    async* mapping(cs: AsyncIterable<CodeStats>,
                                   originalQuery: () => AsyncIterable<ProjectAnalysis>): AsyncIterable<ProjectAnalysis & { lang: string }> {
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

    // Aspects found in this project
    aspectCount: params =>
        treeBuilderFor("aspectCount", params)
            .renderWith(ar => {
                // TODO fix this using new support
                const rendered = defaultAnalyzedRenderer()(ar);
                rendered.size = _.uniq(ar.fingerprints.map(fp => fp.type)).length;
                return rendered;
            }),
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

/**
 * Group by the number of fingerprints from this aspects
 */
function groupByFingerprintCount(aspect: BaseAspect): AnalyzedGrouper {
    return ar => {
        const cm = ar.fingerprints.filter(fp => aspect.name === (fp.type || fp.name)).length;
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

/**
 * Report on all fingerprints of a particular type
 */
export function aspectReport(type: string, fm: AspectRegistry, allMatching: FP[]): ReportBuilder<FP> {
    return treeBuilder<FP>(type)
        .group({
            name: "name",
            by: fp => fp.type === type ? fp.name : undefined,
        })
        .renderWith(fp => {
            const aspect = fm.aspectOf(fp.type);
            return {
                name: aspect ? aspect.toDisplayableFingerprint(fp) : JSON.stringify(fp.data),
                size: allMatching.filter(a => fp.sha === a.sha).length,
            };
        });
}
