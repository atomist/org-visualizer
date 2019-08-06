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
    CodeStats,
    consolidate,
    Language,
} from "@atomist/sdm-pack-sloc/lib/slocReport";
import * as _ from "lodash";
import { Analyzed } from "../aspect/AspectRegistry";
import { findCodeMetricsData } from "../aspect/common/codeMetrics";
import { Reporters } from "../aspect/reporters";
import { treeBuilder } from "../tree/TreeBuilder";
import { bandFor } from "../util/bands";

export type AnalyzedGrouper = (ar: Analyzed) => string;

const groupByLoc: AnalyzedGrouper = ar => {
    const cm = findCodeMetricsData(ar);
    if (!cm) {
        return undefined;
    }
    return bandFor({
        small: { upTo: 2000 },
        tall: { upTo: 8000 },
        grande: { upTo: 20000 },
        venti: "default",
    }, cm.lines);
};

/**
 * Well known reporters against our repo cohort.
 */
export const WellKnownReporters: Reporters = {

    langs:
        treeBuilder<Analyzed>("languages")
            .customGroup<CodeStats>({
                name: "language", to: async ars => {
                    const cms: CodeStats[] = [];
                    for await (const ar of ars) {
                        const cm = findCodeMetricsData(ar);
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
            .map<Analyzed & { lang: string }>({
                async* mapping(cs: AsyncIterable<CodeStats>,
                               originalQuery: () => AsyncIterable<Analyzed>): AsyncIterable<Analyzed & { lang: string }> {
                    // TODO don't materialize this
                    const source: Analyzed[] = [];
                    for await (const pa of originalQuery()) {
                        source.push(pa);
                    }
                    for await (const s of cs) {
                        for (const r of source.filter(ar => {
                            const cm = findCodeMetricsData(ar) || { languages: [] };
                            return cm.languages.some(l => l.language.name === s.language.name);
                        })
                            .map(ar => ({ ...ar, lang: s.language.name }))) {
                            yield r;
                        }
                    }
                },
            })
            .renderWith(ar => {
                const cm = findCodeMetricsData(ar) || { languages: [] };
                const size = cm.languages.find(l => l.language.name === ar.lang).total;
                return {
                    name: ar.id.repo,
                    size,
                    url: `/projects/${ar.id.owner}/${ar.id.repo}`,
                    owner: ar.id.owner,
                    repoUrl: ar.id.url,
                };
            }),

    loc:
        treeBuilder<Analyzed>("loc")
            .group({ name: "size", by: groupByLoc })
            .split<CodeStats>({
                splitter: ar => {
                    const cm = findCodeMetricsData(ar) || { languages: [] };
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
};
