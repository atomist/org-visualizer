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

import { FP } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";

export interface SunburstTree {
    name: string;
    children: Array<SunburstTree | SunburstLeaf>;
}

export interface SunburstLeaf {
    name: string;
    size: number;
}

export type SunburstLevel = SunburstTree | SunburstLeaf;

export function isSunburstTree(level: SunburstLevel): level is SunburstTree {
    const maybe = level as SunburstTree;
    return !!maybe.children;
}

export function visit(t: SunburstLevel,
                      visitor: (sl: SunburstLevel, depth: number) => boolean, depth: number = 0): void {
    const r = visitor(t, depth);
    if (r && isSunburstTree(t)) {
        t.children.forEach(c => visit(c, visitor, depth + 1));
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

/**
 * Merge siblings
 * @param tr tree to operate on
 * @param {(l: SunburstTree) => boolean} parentSelector selector parents to merge
 * @param {(l: SunburstLevel) => string} grouper grouping function for children of selected parents
 */
export function mergeSiblings(tr: SunburstTree,
                              parentSelector: (l: SunburstTree) => boolean,
                              grouper: (l: SunburstLevel) => string): SunburstTree {
    const t = _.cloneDeep(tr);
    visit(t, l => {
        if (isSunburstTree(l) && parentSelector(l)) {
            const grouped: Record<string, SunburstLevel[]> = _.groupBy(l.children, grouper);
            l.children = [];
            for (const name of Object.keys(grouped)) {
                let children: SunburstLevel[] = _.flatten(grouped[name]);
                if (!children.some(c => c.name !== name)) {
                    children = _.flatten(children.map(childrenOf));
                }
                l.children.push({
                    name,
                    children,
                });
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
        if (isSunburstTree(l) && !l.children.some(c => leavesUnder(c).length > 1)) {
            (l as any as SunburstLeaf).size = l.children.length;
            l.children = undefined;
        }
        return true;
    });
    return t;
}

export interface SplitByOptions<T> {

    /**
     * Classify a descendant. Undefined means this descendant is irrelevant.
     */
    descendantClassifier: (t: SunburstLevel & T) => string | undefined;

    /**
     * Depth at which to activate split and put in an extra layer
     */
    newLayerDepth: number;

    /**
     * Source all descendants we may be interested in classifying on.
     * Default is leaves
     * @param {SunburstTree} l
     * @return {SunburstLevel[]}
     */
    descendantFinder?: (l: SunburstTree) => SunburstLevel[];

}

/**
 * Introduce a new level splitting by by the given classifier for descendants
 */
// TODO introduce level?
export function splitBy<T = {}>(tr: SunburstTree,
                                how: SplitByOptions<T>): SunburstTree {
    const opts = {
        descendantFinder: descendants,
        ...how,
    };
    // Find descendants we're introduced in
    const descendantPicker = tree => opts.descendantFinder(tree).filter(n => !!opts.descendantClassifier(n as any));
    const t = _.cloneDeep(tr);
    visit(t, (l, depth) => {
        if (depth === opts.newLayerDepth && isSunburstTree(l)) {
            // Split children
            const descendantsToClassifyBy = descendantPicker(l);
            logger.info("Found %d leaves for %s", descendantsToClassifyBy.length, t.name);
            // Introduce a new level for each classification
            const distinctNames = _.uniq(descendantsToClassifyBy.map(d => opts.descendantClassifier(d as any)));
            const oldKids = l.children;
            l.children = [];
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
                    l.children.push(prunedSubTree);
                }
            }
            return false;
        }
        return true;
    });
    return t;
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
