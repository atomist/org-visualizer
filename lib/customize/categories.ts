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

import { Aspect } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { FingerprintUsage } from "../analysis/offline/persist/ProjectAnalysisResultStore";

export interface ReportDetails {
    name?: string;
    shortName?: string;
    type?: string;
    description?: string;
    url?: string;
}

const AspectCategories: Record<string, string[]> = {};
const AspectReportDetails: ReportDetails[] = [];

/**
 * Store a categories for a given Aspects
 */
export function registerCategories(aspect: Pick<Aspect<any>, "name">,
                                   ...categories: string[]): void {
    AspectCategories[aspect.name] = categories;
}

/**
 * Store a details for a given Aspects
 */
export function registerReportDetails(aspect: Aspect<any>,
                                      details: ReportDetails = {}): void {
    AspectReportDetails.push({
        name: aspect.displayName,
        type: aspect.name,
        description: `Details about the ${aspect.displayName} aspect`,
        url: `filter/aspectReport?type=${aspect.name}`,
        ...details,
    });
}

/**
 * Retrieve categories or undefined for a given Aspect
 */
export function getCategories(aspect: Pick<Aspect<any>, "name">): string[] | undefined {
    return AspectCategories[aspect.name];
}

export interface AspectReport {
    category: string;
    count: number;
    aspects: ReportDetails[];
}

export function getAspectReports(fus: FingerprintUsage[],
                                 workspaceId: string): AspectReport[] {

    const reports: AspectReport[] = [];

    const categories = _.uniq(_.flatten(_.values(AspectCategories)));

    categories.forEach(k => {
        const fu = fus.filter(f => (f.categories || []).includes(k));
        if (fu.length > 0) {
            reports.push({
                category: k,
                count: fu.length,
                aspects: _.uniqBy(fu.filter(f => !!AspectReportDetails.some(a => a.type === f.type)).map(f => {
                    const rd = AspectReportDetails.find(a => a.type === f.type);
                    return {
                        ...rd,
                        url: `/api/v1/${workspaceId}/${rd.url}`,
                    };
                }), "url").sort((r1, r2) => {
                    const i1 = AspectReportDetails.findIndex(r => r.type === r1.type);
                    const i2 = AspectReportDetails.findIndex(r => r.type === r2.type);
                    return i1 - i2;

                }),
            });
        }
    });

    return reports;

}
