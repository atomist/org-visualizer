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
import { TagGroup } from "../../views/sunburstPage";

describe("buttons to change the selected tags in the explore view of sunburst", () => {
    it("takes in the tag selection and the tags available in the data", () => {
        const subject = new TagGroup(["node", "!dead"], { tags: [] });
    });

    it("doesn't barf when the tree is not provided", () => {
        const subject = new TagGroup(["node", "!dead"], undefined);
        subject.allTagNames();
    });

    it("lists the names of all the tags", () => {
        const subject = new TagGroup(["node"], { tags: [{ name: "frog", count: 3 }] });
        const allTagNames = subject.allTagNames();
        assert(allTagNames.includes("node"), "all selected tags belong here");
        assert(allTagNames.includes("frog"), "all data tags belong here");
    });

    it("includes tags that are excluded in the selection criteria", () => {
        const subject = new TagGroup(["node", "!dead"], { tags: [{ name: "frog", count: 3 }] });
        const allTagNames = subject.allTagNames();
        assert(allTagNames.includes("dead"), "excluded selected tags belong here too");
    });

    it("does not list a tag twice, even if it's in both", () => {
        const subject = new TagGroup(["node"], { tags: [{ name: "node", count: 3 }] });
        const allTagNames = subject.allTagNames();
        assert.deepStrictEqual(allTagNames, ["node"], "No duplicate tag names please");
    });

    it("knows that selected tags (and only these) are required", () => {
        const subject = new TagGroup(["node", "hot", "!dead"], {
            tags: [
                { name: "frog", count: 3 },
                { name: "hot", count: 3 },
            ],
        });
        assert(subject.isRequired("node"), "Selected tags are required");
        assert(subject.isRequired("hot"), "Selected+data tags are required");
        assert(!subject.isRequired("frog"), "Data tags are not required");
        assert(!subject.isRequired("dead"), "Excluded tags are not required");
    });

    it("knows that selected-for-exclusion tags (and only these) are excluded", () => {
        const subject = new TagGroup(["node", "hot", "!dead"], {
            tags: [
                { name: "frog", count: 3 },
                { name: "hot", count: 3 },
            ],
        });
        assert(!subject.isExcluded("node"), "Selected tags are required");
        assert(!subject.isExcluded("hot"), "Selected+data tags are required");
        assert(!subject.isExcluded("frog"), "Data tags are not required");
        assert(subject.isExcluded("dead"), "Excluded tags are not required");
    });

    it("describes what will happen if you toggle whether to require this tag", () => {
        const subject = new TagGroup(["node", "hot", "!dead"], {
            tags: [
                { name: "frog", count: 3 },
                { name: "hot", count: 3 },
            ],
        });
        assert.strictEqual(subject.describeRequire("node"), "Currently showing only node projects");
        assert.strictEqual(subject.describeRequire("hot"), "Currently showing only hot projects");
        assert.strictEqual(subject.describeRequire("dead"), "Show only dead projects");
        assert.strictEqual(subject.describeRequire("frog"), "Show only frog projects (3)");
    });

    it("describes what it will do if you toggle exclude on this tag", () => {
        const subject = new TagGroup(["node", "hot", "!dead"], {
            tags: [
                { name: "frog", count: 3 },
                { name: "hot", count: 3 },
            ],
        });
        assert.strictEqual(subject.describeExclude("node"), "Switch to excluding node projects");
        assert.strictEqual(subject.describeExclude("hot"), "Switch to excluding hot projects");
        assert.strictEqual(subject.describeExclude("dead"), "Currently excluding dead projects");
        assert.strictEqual(subject.describeExclude("frog"), "Exclude frog projects");
    });

    it("produces the tagSelection that results from requiring a tag currently not selected-on", () => {
        assert.deepStrictEqual(new TagGroup([]).tagSelectionForRequire("newbie"), ["newbie"], "From no tag selected, to one selected");
        assert.deepStrictEqual(new TagGroup(["other"]).tagSelectionForRequire("newbie"),
            ["other", "newbie"], "From one tag selected, to two selected");
    });
    it("produces the tagSelection that results from clicking require on a tag currently required", () => {
        assert.deepStrictEqual(new TagGroup(["other", "seethis"]).tagSelectionForRequire("seethis"),
            ["other"], "From required, to not required");
        assert.deepStrictEqual(new TagGroup(["seethis"]).tagSelectionForRequire("seethis"),
            [], "From one tag required, to none");
    });
    it("produces the tagSelection that results from requiring a tag currently excluded", () => {
        assert.deepStrictEqual(new TagGroup(["other", "!goaway"]).tagSelectionForRequire("goaway"),
            ["other", "goaway"], "From excluded, to required");
    });
    it("produces the tagSelection that results from excluding a tag currently not selected-on", () => {
        assert.deepStrictEqual(new TagGroup([]).tagSelectionForExclude("goaway"), ["!goaway"], "From no tag selected, to one excluded");
        assert.deepStrictEqual(new TagGroup(["humboe"]).tagSelectionForExclude("goaway"),
            ["humboe", "!goaway"], "From no tag selected, to one excluded");

    });
    it("produces the tagSelection that results from clicking exclude on a tag already excluded", () => {
        assert.deepStrictEqual(new TagGroup(["!goaway"]).tagSelectionForExclude("goaway"), [], "From one tag excluded, to none");
        assert.deepStrictEqual(new TagGroup(["!goaway", "!humboe"]).tagSelectionForExclude("goaway"),
            ["!humboe"], "From two excluded, to one");
    });
    it("produces the tagSelection that results from excluding a tag currently required", () => {
        assert.deepStrictEqual(new TagGroup(["mememe", "!humboe"]).tagSelectionForExclude("mememe"),
            ["!humboe", "!mememe"], "From required, to excluded");
    });

});
