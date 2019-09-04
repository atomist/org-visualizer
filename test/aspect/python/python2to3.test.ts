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

import { InMemoryProject } from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import * as assert from "assert";
import { PythonVersion } from "../../../lib/aspect/python/python2to3";

describe("An aspect distinguishes between Python versions used", () => {
    it("Returns no fingerprint on a project with no python in it", async () => {
        const project = InMemoryProject.of({ path: "README.txt", content: "No Python here" });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1);
        assert.deepStrictEqual(fingerprints[0].data.tags, ["pythonless"]);
    });

    it("Defaults to indeterminate", async () => {
        const project = InMemoryProject.of({ path: "something.py", content: "" });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1);
        assert.deepStrictEqual(fingerprints[0].data.tags, ["python-version-unknown"]);
    });

    it("Identifies the Python 2 print statement", async () => {
        const project = InMemoryProject.of({
            path: "something.py", content: `
# blah blah
print "Hello world"
# blah blah` });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1);
        assert.deepStrictEqual(fingerprints[0].data.tags, ["python2"]);
    });
});
