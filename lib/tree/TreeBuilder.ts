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

import * as _ from "lodash";
import {
    PlantedTree,
    SunburstCircleMetadata,
    SunburstLeaf,
    SunburstTree,
} from "./sunburst";

/**
 * Implemented by types that can create JSON usable to back a d3 sunburst
 * or other displayable formats from a set of repositories.
 */
export interface ReportBuilder<ROOT> {

    /**
     * Construct a PlantedTree from the given data.
     * @param {() => (ROOT[] | AsyncIterable<ROOT>)} query
     * @return {Promise<SunburstTree>}
     */
    toPlantedTree(query: () => ROOT[] | AsyncIterable<ROOT>): Promise<PlantedTree>;
}

export type Renderer<T> = (t: T) => SunburstLeaf;

/**
 * Access analysis data to emit a sunburst tree. All calculations will
 * be performed in memory once an initial cohort of repo analyses is provided.
 * All methods cause a tree layer to be emitted except for map
 */
export interface TreeBuilder<ROOT, T> {

    /**
     * Name of the tree rout
     */
    readonly rootName: string;

    /**
     * Group values in the present layer by classifying each individual value.
     * Return undefined to exclude a value
     */
    group(groupStep: GroupStep<T>): TreeBuilder<ROOT, T>;

    /**
     * Group all values in the present layer in one go
     * @param {CustomGroupStep<T, Q>} customGroupStep
     * @return {TreeBuilder<Q>}
     */
    customGroup<Q>(customGroupStep: CustomGroupStep<T, Q>): TreeBuilder<ROOT, Q>;

    /**
     * Split each T into multiple Qs, emitting a layer
     */
    split<Q>(splitStep: SplitStep<T, Q>): TreeBuilder<ROOT, Q>;

    /**
     * Map or suppress values. Does not emit a layer.
     * Can be used to filter as undefined values will be excluded
     */
    map<Q>(mapStep: MapStep<ROOT, T, Q>): TreeBuilder<ROOT, Q>;

    /**
     * Setting the renderer for leaf nodes gives us a ReportBuilder we can
     * use to transform passed in data.
     * @param {(t: T) => SunburstLeaf} renderer
     * @return {SunburstTree}
     */
    renderWith(renderer: Renderer<T>): ReportBuilder<ROOT>;
}

/**
 * Group records in this layer by a string
 */
export interface GroupStep<T> {
    name: string;
    by: (t: T) => string | Promise<string>;
    flattenSingle?: boolean;
}

export interface CustomGroupStep<T, Q> {
    name: string;
    to: (t: T[] | AsyncIterable<T>) => Promise<Record<string, Q[]>> | Record<string, Q[]>;
    flattenSingle?: boolean;
}

/**
 * Map all the n records in this layer to m Qs
 */
export interface MapStep<ROOT, T, Q> {
    mapping: (t: AsyncIterable<T> | T[], originalQuery: () => ROOT[] | AsyncIterable<ROOT>) => AsyncIterable<Q>;
}

/**
 * Split every record T in this layer into n Qs
 */
export interface SplitStep<T, Q> {

    splitter: (t: T) => Promise<Q[]> | Q[];

    namer: (t: T) => string;
}

// Add a kind field to help with type determination
type Step = (GroupStep<any> | CustomGroupStep<any, any> | MapStep<any, any, any> | SplitStep<any, any>) &
    { kind: "group" | "split" | "customGroup" | "map", name?: string };

class DefaultTreeBuilder<ROOT, T> implements TreeBuilder<ROOT, T> {

    private readonly steps: Step[] = [];

    public split<Q>(splitStep: SplitStep<T, Q>): TreeBuilder<ROOT, Q> {
        this.steps.push({ ...splitStep, kind: "split" });
        return this as any;
    }

    public group(groupStep: GroupStep<T>): TreeBuilder<ROOT, T> {
        this.steps.push({ ...groupStep, kind: "group" });
        return this;
    }

    public customGroup<Q>(customGroupStep: CustomGroupStep<T, Q>): TreeBuilder<ROOT, Q> {
        this.steps.push({ ...customGroupStep, kind: "customGroup" });
        return this as any;
    }

    public map<Q>(mapStep: MapStep<ROOT, T, Q>): TreeBuilder<ROOT, Q> {
        this.steps.push({ ...mapStep, kind: "map" });
        return this as any;
    }

    /**
     * Creates the final tree
     * @param {(t: T) => SunburstLeaf} renderer
     * @return {SunburstTree}
     */
    public renderWith(renderer: Renderer<T>): ReportBuilder<ROOT> {
        return {
            toPlantedTree: async originalQuery => {
                const data: ROOT[] = [];
                for await (const root of originalQuery()) {
                    data.push(root);
                }
                const tree = await this.treeify(data, renderer);
                const circles: SunburstCircleMetadata[] = [
                    ...this.steps
                        .filter(step => !!step.name)
                        .map(step => ({
                            meaning: step.name,
                        })),
                    { meaning: "render" },
                ];
                return { tree, circles };
            },
        };
    }

    // Make a single tree from materialized data
    private async treeify(data: ROOT[], renderer: Renderer<T>): Promise<SunburstTree> {
        return {
            name: this.rootName,
            children: await layer<ROOT, T>(() => data, data, this.steps, renderer),
        };
    }

    /**
     *
     * @param {string} rootName
     */
    public constructor(public readonly rootName: string) {
    }

}

export function treeBuilder<ROOT, T = ROOT>(rootName: string): TreeBuilder<ROOT, T> {
    return new DefaultTreeBuilder(rootName);
}

async function layer<ROOT, T>(originalQuery: () => AsyncIterable<ROOT> | ROOT[],
                              currentLayerData: AsyncIterable<any> | ROOT[],
                              steps: Step[],
                              renderer: Renderer<T>): Promise<Array<SunburstTree | SunburstLeaf>> {
    if (steps.length === 0) {
        const results: SunburstLeaf[] = [];
        for await (const l of currentLayerData) {
            results.push(renderer(l));
        }
        return results;
    }
    const step = steps[0];
    switch (step.kind) {
        case "customGroup":
        case "group" :
            let groups;
            if (step.kind === "customGroup") {
                groups = await (step as CustomGroupStep<any, any>).to(currentLayerData);
            } else {
                const evaluations: Array<{ e: any, result: string }> = [];
                for await (const e of currentLayerData) {
                    evaluations.push(await Promise.resolve((step as GroupStep<any>).by(e)).then(result => ({
                        e,
                        result,
                    })));
                }
                groups = _.groupBy(currentLayerData, e => evaluations.find(ev => ev.e === e).result);
            }
            // Lodash returns the name as the string "undefined"
            const groupNames = Object.getOwnPropertyNames(groups).filter(name => name !== "undefined");
            if (groupNames.length === 1 && (step as GroupStep<any>).flattenSingle) {
                return layer(originalQuery, currentLayerData, steps.slice(1), renderer);
            } else {
                return Promise.all(groupNames.map(async name => {
                    return {
                        name,
                        children: await layer(originalQuery, await groups[name], steps.slice(1), renderer),
                    };
                }));
            }
        case "split":
            const splitStep = step as SplitStep<any, any>;
            const kids: any[] = [];
            for await (const t of currentLayerData) {
                kids.push({
                    name: splitStep.namer(t),
                    children: await layer(originalQuery,
                        (await splitStep.splitter(t))
                            .filter(x => !!x),
                        steps.slice(1), renderer),
                });
            }
            return kids;

        case "map":
            const mapStep = step as MapStep<any, any, any>;
            return layer(originalQuery, mapStep.mapping(currentLayerData, originalQuery), steps.slice(1), renderer);
        default:
            throw new Error(`Unknown step type '${step.kind}'`);
    }
}
