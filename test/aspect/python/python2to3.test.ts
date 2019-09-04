import { InMemoryProject } from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import * as assert from "assert";
import { PythonVersion } from "../../../lib/aspect/python/python2to3";

describe("An aspect distinguishes between Python versions used", () => {
    it("Returns no fingerprint on a project with no python in it", async () => {
        const project = InMemoryProject.of({ path: "README.txt", content: "No Python here" });
        const fingerprints = await PythonVersion.extract(project, undefined);
        // empty array would also be fine
        assert(!fingerprints, "Expected no fingerprints in a project without python");
    });

    it("Defaults to indeterminate", async () => {
        const project = InMemoryProject.of({ path: "something.py", content: "" });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1);

    });
});
