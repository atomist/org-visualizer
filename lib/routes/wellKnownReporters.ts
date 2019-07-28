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
import { CodeStats, consolidate, Language } from "@atomist/sdm-pack-sloc/lib/slocReport";
import * as _ from "lodash";
import { Analyzed } from "../aspect/AspectRegistry";
import { Reporters } from "../aspect/reporters";
import {
    defaultAnalyzedRenderer,
    OrgGrouper,
    ProjectAnalysisGrouper,
} from "../aspect/support/groupingUtils";
import { CodeMetricsElement } from "../element/codeMetricsElement";
import { treeBuilder, TreeBuilder } from "../tree/TreeBuilder";

/**
 * Well known reporters against our repo cohort.
 * Works against full analyses.
 */
export const WellKnownReporters: Reporters = {

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

export function treeBuilderFor<A extends Analyzed = Analyzed>(name: string, params: any): TreeBuilder<A, A> {
    const tb = treeBuilder<A>(name);
    return (params.byOrg === "true") ?
        tb.group({ name: "org", by: OrgGrouper }) :
        tb;
}
