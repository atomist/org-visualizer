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
    SunburstTree,
} from "../../lib/tree/sunburst";
import { pruneLeaves } from "../../lib/tree/treeUtils";

describe("pruneLeaves", () => {

    it("should prune empty tree", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [],
        };
        const pruned = pruneLeaves(t1, () => true);
        assert.deepStrictEqual(pruned, t1);
    });

    it("should not prune tree with single node and no prune match", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "tony",
                    size: 1,
                },
            ],
        };
        const pruned = pruneLeaves(t1, () => false);
        assert.deepStrictEqual(pruned, t1);
    });

    it("should prune tree with single node and prune match", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "tony",
                    size: 1,
                },
            ],
        };
        const pruned = pruneLeaves(t1, () => true);
        assert.deepStrictEqual(pruned, { name: "name", children: [] });
    });

    it("should prune tree with single node and single prune match", () => {
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
        const pruned = pruneLeaves(t1, l => l.name === "jeremy");
        assert.deepStrictEqual(pruned, {
            name: "name", children: [{
                name: "tony", size: 1,
            }],
        });
    });

    it("should prune two level tree tree with single node and single prune match", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "leaders",
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
                },
            ],
        };
        const pruned = pruneLeaves(t1, l => l.name === "jeremy");
        assert.deepStrictEqual(pruned, {
            name: "name", children: [{
                name: "leaders", children: [{
                    name: "tony", size: 1,
                }],
            }],
        });
    });
});
