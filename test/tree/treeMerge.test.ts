import { mergeTrees, SunburstTree } from "../../lib/tree/sunburst";
import * as assert from "assert";

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
                }
            ],
        };
        const t2: SunburstTree = {
            name: "name",
            children: [
                {
                    name: "gordon",
                    size: 1,
                }
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
                }
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
                        }
                    ],
                },
                {
                    name: "Tory",
                    children: [
                        {
                            name: "david",
                            size: 1,
                        }
                    ],
                }
            ]
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
                        }
                    ],
                },
                {
                    name: "Tory",
                    children: [
                        {
                            name: "theresa",
                            size: 1,
                        }
                    ],
                }]
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
                        }
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
                        }
                    ],
                }]
        });
    });

});
