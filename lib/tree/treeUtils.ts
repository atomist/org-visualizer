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

import { logger } from "@atomist/automation-client";
import * as _ from "lodash";
import {
    isSunburstTree,
    PlantedTree,
    SunburstLeaf,
    SunburstLevel,
    SunburstTree,
} from "./sunburst";

export function visit(
    t: SunburstLevel,
    visitor: (sl: SunburstLevel, depth: number) => boolean,
    depth: number = 0): void {
    const keepGoing = visitor(t, depth);
    if (keepGoing && isSunburstTree(t)) {
        (t.children || []).forEach(c => visit(c, visitor, depth + 1));
    }
}

export async function visitAsync(t: SunburstLevel,
                                 visitor: (sl: SunburstLevel, depth: number) => Promise<boolean>,
                                 depth: number = 0): Promise<void> {
    const r = await visitor(t, depth);
    if (r && isSunburstTree(t)) {
        await Promise.all(t.children.map(c => visitAsync(c, visitor, depth + 1)));
    }
}

/**
 * Suppress branches that meet a condition
 */
function killChildren(tr: SunburstTree,
                      shouldEliminate: (tl: SunburstLevel, depth: number) => boolean): SunburstTree {
    const t = _.cloneDeep(tr);
    visit(t, (l, depth) => {
        if (isSunburstTree(l)) {
            l.children = l.children.filter(c => {
                if (isSunburstTree(c)) {
                    return true;
                }
                const kill = shouldEliminate(c, depth + 1);
                // logger.debug("Kill = %s for %s of depth %d", kill, c.name, depth);
                return !kill;
            });
            return true;
        }
        return true;
    });
    return t;
}

export interface GroupSiblingsOptions {

    /**
     * Selector for parents to merge
     */
    parentSelector: (l: SunburstTree) => boolean;

    /**
     * Group siblings to merge under selected parents
     */
    childClassifier: (l: SunburstLevel) => string;

    /**
     * Decorator the new levels
     * @param {SunburstLevel} l
     */
    groupLayerDecorator?: (l: SunburstLevel) => void;

    /**
     * If provided, identifies new grouped node names to collapse under
     */
    collapseUnderName?: (name: string) => boolean;
}

/**
 * Merge siblings into groups by the grouper
 */
export function groupSiblings(tr: SunburstTree,
                              params: GroupSiblingsOptions): SunburstTree {
    const opts = {
        collapseUnderName: () => false,
        ...params,
    };
    const t = _.cloneDeep(tr);
    visit(t, l => {
        if (isSunburstTree(l) && opts.parentSelector(l)) {
            const grouped: Record<string, SunburstLevel[]> = _.groupBy(l.children, opts.childClassifier);
            if (Object.values(grouped).every(a => a.length === 1)) {
                // Nothing needs merged
                return false;
            }
            l.children = [];
            for (const name of Object.keys(grouped)) {
                let children: SunburstLevel[] = _.flatten(grouped[name]);
                if (opts.collapseUnderName(name)) {
                    children = _.flatten(children.map(childrenOf));
                }
                const newLayer = {
                    name,
                    children,
                };
                if (opts.groupLayerDecorator) {
                    opts.groupLayerDecorator(newLayer);
                }
                l.children.push(newLayer);
            }
            return false;
        }
        return true;
    });
    return t;
}

/**
 * Trim the outer rim, replacing the next one with sized leaves
 */
export function trimOuterRim(tr: SunburstTree): SunburstTree {
    const t = _.cloneDeep(tr);
    visit(t, l => {
        if (isSunburstTree(l) && !l.children.some(isSunburstTree)) {
            (l as any as SunburstLeaf).size = l.children.length;
            delete (l.children);
        }
        return true;
    });
    return t;
}

export interface ClassificationLayerOptions<T> {

    /**
     * Classify a descendant. Undefined means this descendant is irrelevant.
     */
    descendantClassifier: (t: SunburstLevel & T) => string | undefined;

    /**
     * Depth at which to activate split and put in an extra layer
     */
    newLayerDepth: number;

    /**
     * What does this new layer mean?
     */
    newLayerMeaning: string;

    /**
     * Source all descendants we may be interested in classifying on.
     * Default is leaves
     * @param {SunburstTree} l
     * @return {SunburstLevel[]}
     */
    descendantFinder?: (l: SunburstTree) => SunburstLevel[];

}

function insertAt<A>(arr: A[], index: number, item: A): A[] {
    arr.splice(index, 0, item);
    return arr;
}

/**
 * Introduce a new level splitting by by the given classifier for descendants
 */
export function introduceClassificationLayer<T = {}>(pt: PlantedTree,
                                                     how: ClassificationLayerOptions<T>): PlantedTree {
    const opts = {
        descendantFinder: descendants,
        ...how,
    };
    const tr = pt.tree;
    if (tr.children.length === 0) {
        return pt;
    }
    const circles = insertAt(pt.circles, opts.newLayerDepth, { meaning: opts.newLayerMeaning });

    // Find descendants we're introduced in
    const descendantPicker = tree => opts.descendantFinder(tree).filter(n => !!opts.descendantClassifier(n as any));
    const t = _.cloneDeep(tr);
    visit(t, (node, depth) => {
        if (depth === (opts.newLayerDepth - 1) && isSunburstTree(node)) {
            // Split children
            const descendantsToClassifyBy = descendantPicker(node);
            logger.info("Found %d leaves for %s", descendantsToClassifyBy.length, t.name);
            // Introduce a new node for each classification
            const distinctNames = _.uniq(descendantsToClassifyBy.map(d => opts.descendantClassifier(d as any)));
            const oldKids = node.children;
            node.children = [];
            for (const name of distinctNames.sort()) {
                const children = oldKids
                    .filter(k =>
                        isSunburstTree(k) && descendantPicker(k).some(leaf => opts.descendantClassifier(leaf as any) === name) ||
                        !isSunburstTree(k) && opts.descendantClassifier(k as any) === name);
                if (children.length > 0) {
                    // Need to take out the children that are trees but don't have a descendant under them
                    const subTree = {
                        name,
                        children,
                    };
                    // Kill the children that have a different descendant classification
                    const prunedSubTree = killChildren(
                        subTree,
                        tt => {
                            const classification = opts.descendantClassifier(tt as any);
                            return !!classification && classification !== name;
                        });
                    node.children.push(prunedSubTree);
                }
            }
            return false;
        }
        return true;
    });

    const result = { tree: t, circles };
    validatePlantedTree(result);
    return result;
}

export function pruneLeaves(tr: SunburstTree, toPrune: (l: SunburstLeaf) => boolean): SunburstTree {
    const copy = _.cloneDeep(tr);
    visit(copy, l => {
        if (isSunburstTree(l) && !l.children.some(isSunburstTree)) {
            l.children = l.children.filter(c => {
                const f = isSunburstTree(c) || !toPrune(c);
                return f;
            });
            return false;
        }
        return true;
    });
    return copy;
}

/**
 * Return all terminals under this level
 * @param {SunburstLevel} t
 * @return {SunburstLeaf[]}
 */
export function leavesUnder(t: SunburstLevel): SunburstLeaf[] {
    const leaves: SunburstLeaf[] = [];
    visit(t, l => {
        if (!isSunburstTree(l)) {
            leaves.push(l);
        }
        return true;
    });
    return leaves;
}

export function descendants(t: SunburstLevel): SunburstLevel[] {
    const descs: SunburstLevel[] = [];
    visit(t, l => {
        descs.push(l);
        if (isSunburstTree(l)) {
            descs.push(..._.flatten(l.children.map(descendants)));
        }
        return true;
    });
    return _.uniq(descs);
}

export function childCount(l: SunburstLevel): number {
    return isSunburstTree(l) ? l.children.length : 0;
}

export function childrenOf(l: SunburstLevel): SunburstLevel[] {
    return isSunburstTree(l) ? l.children : [];
}

/**
 * Merge these trees. They must have the same name.
 * Trees may be merged in memory because they may have many nodes, but don't have much data.
 * @return {SunburstTree}
 */
export function mergeTrees(...trees: SunburstTree[]): SunburstTree {
    if (trees.length === 1) {
        return trees[0];
    }
    return trees.reduce(merge2Trees);
}

function merge2Trees(t1: SunburstTree, t2: SunburstTree): SunburstTree {
    if (t1.name !== t2.name) {
        throw new Error(`Trees with different names cannot be merged. Had '${t1.name}' and '${t2.name}'`);
    }
    const mergedChildren: SunburstLevel[] = [];

    for (const child of [...t1.children, ...t2.children]) {
        const existing = mergedChildren.find(n => n.name === child.name);
        if (existing) {
            if (!isSunburstTree(existing)) {
                if (isSunburstTree(child)) {
                    throw new Error(`Cannot add tree child to non-tree ${JSON.stringify(existing)}`);
                }
                // TODO what about label?
                existing.size += child.size;
            } else {
                const merged = mergeTrees(existing, child as SunburstTree);
                const index = mergedChildren.indexOf(existing);
                mergedChildren[index] = merged;
            }
        } else {
            mergedChildren.push(child);
        }
    }

    const result: SunburstTree = {
        name: t1.name,
        children: mergedChildren,
    };

    // console.log(JSON.stringify(result));
    return result;
}

export function validatePlantedTree(pt: PlantedTree): void {
    checkNullChildrenInvariant(pt);
    checkDepthInvariant(pt);
}

function checkDepthInvariant(pt: PlantedTree): void {
    let depth = 0;
    visit(pt.tree, (l, d) => {
        if (d > depth) {
            depth = d;
        }
        return true;
    });
    // the tree counts depth from zero
    if ((depth + 1) !== pt.circles.length) {
        logger.error("Data: " + JSON.stringify(pt, undefined, 2));
        logger.error(`Expected a depth of ${pt.circles.length} but saw a tree of depth ${depth + 1}`);
    }
}

function checkNullChildrenInvariant(pt: PlantedTree): void {
    const haveNullChildren: SunburstTree[] = [];
    visit(pt.tree, (l, d) => {
        if (isSunburstTree(l) && l.children === null) {
            haveNullChildren.push(l);
        }
        return true;
    });
    // the tree counts depth from zero
    if (haveNullChildren.length > 0) {
        logger.error("Tree: " + JSON.stringify(pt.tree, undefined, 2));
        throw new Error(`${haveNullChildren.length} tree nodes have null children: ${JSON.stringify(haveNullChildren)}`);
    }
}
