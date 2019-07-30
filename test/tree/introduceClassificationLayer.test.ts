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

import * as assert from "assert";
import {
    PlantedTree,
    SunburstTree,
} from "../../lib/tree/sunburst";
import { introduceClassificationLayer } from "../../lib/tree/treeUtils";

describe("introduceClassificationLayer", () => {

    it("should not split empty tree", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [],
        };
        const pt: PlantedTree = {
            tree: t1,
            circles: [{ meaning: "something" }],
        };
        const split = introduceClassificationLayer(pt, {
            descendantClassifier: () => "x",
            newLayerDepth: 1,
            newLayerMeaning: "an x",
        });
        assert.deepStrictEqual(split.tree, t1);
    });

    it("should split tree with single node", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "tony",
                    size: 1,
                },
            ],
        };

        const pt: PlantedTree = {
            tree: t1,
            circles: [{ meaning: "something" }, { meaning: "person" }],
        };
        const split = introduceClassificationLayer(pt, {
            descendantClassifier: () => "x",
            newLayerDepth: 1,
            newLayerMeaning: "just an x",
        });
        assert.deepStrictEqual(split.tree, {
            name: "name",
            children: [{
                name: "x",
                children: [
                    {
                        name: "tony",
                        size: 1,
                    }],
            }],
        });
    });

    it("should split tree with two nodes", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "tony",
                    size: 1,
                },
                {
                    name: "jeremy",
                    size: 1,
                },
            ],
        };
        const pt: PlantedTree = {
            tree: t1,
            circles: [{ meaning: "something" }, { meaning: "person" }],
        };
        const split = introduceClassificationLayer(pt, {
            descendantClassifier: n => n.name === "tony" ? "center" : "left",
            newLayerDepth: 1,
            newLayerMeaning: "political leaning",
        });
        assert.deepStrictEqual(split.tree, {
            name: "name",
            children: [{
                name: "center",
                children: [
                    {
                        name: "tony",
                        size: 1,
                    }],
            }, {
                name: "left",
                children: [
                    {
                        name: "jeremy",
                        size: 1,
                    }],
            }],
        });
    });

    it("should split tree with two nodes at level 3", () => {
        const t1: SunburstTree = {
            name: "nougat",
            children: [
                {
                    name: "Labour", children: [
                        {
                            name: "tony",
                            size: 1,
                        },
                        {
                            name: "jeremy",
                            size: 1,
                        },
                    ],
                },
            ],
        };
        const pt: PlantedTree = {
            tree: t1,
            circles: [{ meaning: "chewy center" }, { meaning: "party" }, { meaning: "person" }],
        };
        const split = introduceClassificationLayer(pt, {
            descendantClassifier: n => n.name === "tony" ? "center" : "left",
            newLayerDepth: 1,
            newLayerMeaning: "political leanings",
        });
        assert.deepStrictEqual(split.tree, {
            name: "nougat",
            children: [
                {
                    name: "center",
                    children: [
                        {
                            name: "Labour",
                            children: [
                                {
                                    name: "tony",
                                    size: 1,
                                },
                            ],
                        },
                    ],
                },
                {
                    name: "left",
                    children: [
                        {
                            name: "Labour",
                            children: [
                                {
                                    name: "jeremy",
                                    size: 1,
                                },
                            ],
                        }],
                }],
        }, JSON.stringify(split, undefined, 2));
    });

});
