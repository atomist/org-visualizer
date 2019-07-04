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
    AggregateFingerprintStatus,
    FeatureManager,
    FingerprintCensus,
    Flagger,
    HasFingerprints,
    IdealResolver,
    ManagedFeature,
} from "./FeatureManager";

import {
    FP,
    PossibleIdeal,
} from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

export function allFingerprints(ar: HasFingerprints | HasFingerprints[]): FP[] {
    return _.flatMap(toArray(ar), a => a.fingerprints);
}

function toArray<T>(value: T | T[]): T[] {
    if (!!value) {
        if (Array.isArray(value)) {
            return value;
        } else {
            return [value];
        }
    } else {
        return undefined;
    }
}

export async function* fingerprintsFrom(ar: HasFingerprints[] | AsyncIterable<HasFingerprints>): AsyncIterable<FP> {
    for await (const hf of ar) {
        for (const fp of hf.fingerprints) {
            yield fp;
        }
    }
}

export type MelbaFingerprintForDisplay = FP & {
    ideal?: PossibleIdeal,
    displayValue: string,
    displayName: string,
};

export interface MelbaFeatureForDisplay {
    feature: ManagedFeature;
    fingerprints: MelbaFingerprintForDisplay[];
}

/**
 * Features must have unique names
 */
export class DefaultFeatureManager implements FeatureManager {

    get features() {
        return this.opts.features;
    }

    public featureFor(fp: FP): ManagedFeature | undefined {
        return !!fp ? this.features.find(f => f.name === (fp.type || fp.name)) : undefined;
    }

    public async fingerprintCensus(repos: HasFingerprints[]): Promise<FingerprintCensus> {
        async function aggregateFingerprints(featureManager: FeatureManager,
                                             feature: ManagedFeature,
                                             fps: FP[]): Promise<AggregateFingerprintStatus> {
            const name = fps[0].name;
            const ideal = await featureManager.idealResolver(name);
            return {
                type: fps[0].type,
                name,
                appearsIn: fps.length,
                variants: _.uniq(fps.map(fp => fp.sha)).length,
                ideal: addDisplayNameToIdeal(defaultedToDisplayableFingerprint(feature), ideal),
                featureName: feature.displayName,
                displayName: defaultedToDisplayableFingerprintName(feature)(name),
            };
        }
        const result: FingerprintCensus = {
            projectsAnalyzed: repos.length,
            features: [],
        };
        const allFingerprintsInAllProjects: FP[] = _.flatMap(repos, allFingerprints);
        for (const feature of this.features) {
            // TODO: Rod: There is an assumption here that all fingerprints with the same name match the same selectors.
            const names = _.uniq(allFingerprintsInAllProjects.filter(fp => feature.name === (fp.type || fp.name)).map(fp => fp.name));
            const fingerprints: AggregateFingerprintStatus[] = [];
            for (const name of names) {
                const theseFingerprints = allFingerprintsInAllProjects.filter(fp => (fp.name === name));
                fingerprints.push(await aggregateFingerprints(this, feature, theseFingerprints));
            }
            result.features.push({
                feature,
                fingerprints,
            });
        }
        return result;
    }

    public async projectFingerprints(par: ProjectAnalysisResult): Promise<MelbaFeatureForDisplay[]> {
        const result = [];
        const allFingerprintsInOneProject: FP[] = allFingerprints(par.analysis);
        for (const feature of this.features) {
            const originalFingerprints =
                _.sortBy(allFingerprintsInOneProject.filter(fp => feature.name === (fp.type || fp.name)), fp => fp.name);
            if (originalFingerprints.length > 0) {
                const fingerprints: MelbaFingerprintForDisplay[] = [];
                for (const fp of originalFingerprints) {
                    fingerprints.push({
                        ...fp,
                        ideal: await this.opts.idealResolver(fp.name),
                        displayValue: defaultedToDisplayableFingerprint(feature)(fp),
                        displayName: defaultedToDisplayableFingerprintName(feature)(fp.name),
                    });
                }
                result.push({
                    feature,
                    fingerprints,
                });
            }
        }
        return result;
    }

    /**
     * TODO - I don't think this worked.
     * Find all the Features we can manage in this project
     */
    public async featuresFound(pa: HasFingerprints): Promise<ManagedFeature[]> {
        return [];
        // return _.uniq(
        //     _.flatMap(Object.getOwnPropertyNames(pa.fingerprints)
        //         .map(name => this.features.filter(f => f.selector(pa.fingerprints[name]))),
        //     ));
    }

    public get flags(): Flagger {
        return this.opts.flags;
    }

    /**
     * Which features could grow in this project that are not already growing.
     * They may not all be present
     */
    public async possibleFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]> {
        throw new Error("not implemented");
    }

    public async necessaryFeaturesNotFound(analysis: HasFingerprints): Promise<ManagedFeature[]> {
        throw new Error("not implemented");
    }

    get idealResolver(): IdealResolver {
        return this.opts.idealResolver;
    }

    constructor(private readonly opts: {
        idealResolver: IdealResolver,
        features: ManagedFeature[],
        flags: Flagger,
    }) {
        opts.features.forEach(f => {
            if (!f) {
                throw new Error("A null feature was passed in");
            }
        });
    }
}

export function defaultedToDisplayableFingerprintName(feature?: ManagedFeature): (fingerprintName: string) => string {
    return (feature && feature.toDisplayableFingerprintName) || (name => name);
}

export function defaultedToDisplayableFingerprint(feature?: ManagedFeature): (fpi: FP) => string {
    return (feature && feature.toDisplayableFingerprint) || (fp => fp && fp.data);
}

function addDisplayNameToIdeal(displayFingerprint: (fpi: FP) => string,
                               ideal?: PossibleIdeal): PossibleIdeal & { displayValue: string } {
    if (!ideal) {
        return undefined;
    }
    const displayValue = ideal.ideal ?
        displayFingerprint(ideal.ideal)
        : "eliminate";
    return {
        ...ideal,
        displayValue,
    };
}
