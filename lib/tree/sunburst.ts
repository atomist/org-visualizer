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

export function visit(t: SunburstLevel, visitor: (sl: SunburstLevel, depth: number) => boolean, depth: number = 0): void {
    const r = visitor(t, depth);
    if (r && isSunburstTree(t)) {
        t.children.forEach(c => visit(c, visitor, depth + 1));
    }
}

/**
 * Introduce a new level split by by the given classifier for terminals
 */
export function splitBy<T = {}>(t: SunburstTree, leafClassifier: (t: SunburstLeaf & T) => string, targetDepth: number): void {
    visit(t, (l, depth) => {
        if (depth === targetDepth && isSunburstTree(l)) {
            // Split children
            const leaves = leavesUnder(l);
            logger.info("Found %d leaves for %s", leaves.length, t.name);
            // Introduce a new level for each classification
            const distinctNames = _.uniq(leaves.map(l => leafClassifier(l as any)));
            const oldKids = l.children;
            l.children = [];
            for (const name of distinctNames) {
                const children = oldKids.filter(k => leavesUnder(k).some(l => leafClassifier(l as any) === name));
                if (children.length > 0) {
                    l.children.push({name, children});
                }
            }
            return false;
        }
        return true;
    });
}

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

/**
 * Merge these trees. They must have the same name.
 * Trees may be merged in memory because they may have many nodes, but don't have much data.
 * @return {SunburstTree}
 */
export function mergeTrees(...trees: SunburstTree[]): SunburstTree {
    // if (trees.length === 0) {
    //     throw "fu"
    // }
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
