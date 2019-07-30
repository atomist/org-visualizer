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
import { mergeTrees } from "../../lib/tree/treeUtils";

describe("treeMerge", () => {

    it("should merge empty trees", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [],
        };
        const t2: SunburstTree = {
            name: "name",
            children: [],
        };
        assert.deepStrictEqual(mergeTrees(t1, t2), t1);
    });

    it("should merge trees with single node each", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "tony",
                    size: 1,
                },
            ],
        };
        const t2: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "gordon",
                    size: 1,
                },
            ],
        };
        assert.deepStrictEqual(mergeTrees(t1, t2), {
            name: "name",
            children: [
                {
                    name: "tony",
                    size: 1,
                },
                {
                    name: "gordon",
                    size: 1,
                },
            ],
        });
    });

    it("should merge trees with two levels each", () => {
        const t1: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "Labor",
                    children: [
                        {
                            name: "tony",
                            size: 1,
                        },
                    ],
                },
                {
                    name: "Tory",
                    children: [
                        {
                            name: "david",
                            size: 1,
                        },
                    ],
                },
            ],
        };
        const t2: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "Labor",
                    children: [
                        {
                            name: "gordon",
                            size: 1,
                        },
                    ],
                },
                {
                    name: "Tory",
                    children: [
                        {
                            name: "theresa",
                            size: 1,
                        },
                    ],
                }],
        };
        const mt = mergeTrees(t1, t2);
        assert.deepStrictEqual(mt, {
            name: "name",
            children: [
                {
                    name: "Labor",
                    children: [
                        {
                            name: "tony",
                            size: 1,
                        },
                        {
                            name: "gordon",
                            size: 1,
                        },
                    ],
                },
                {
                    name: "Tory",
                    children: [
                        {
                            name: "david",
                            size: 1,
                        },
                        {
                            name: "theresa",
                            size: 1,
                        },
                    ],
                }],
        });
    });

    it("should add sizes in trees with single node each", () => {
        const t1: SunburstTree = {
            name: "votes",
            children: [
                {
                    name: "Labour",
                    size: 1,
                },
            ],
        };
        const t2: SunburstTree = {
            name: "votes",
            children: [
                {
                    name: "Labour",
                    size: 2,
                },
            ],
        };
        const t3: SunburstTree = {
            name: "votes",
            children: [
                {
                    name: "Conservative",
                    size: 2,
                },
            ],
        };

        assert.deepStrictEqual(mergeTrees(t1, t2, t3), {
            name: "votes",
            children: [
                {
                    name: "Labour",
                    size: 3,
                },
                {
                    name: "Conservative",
                    size: 2,
                },
            ],
        });
    });

});
