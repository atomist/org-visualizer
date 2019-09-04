import { InMemoryProject } from "@atomist/automation-client";
import * as assert from "assert";
import { PythonVersion } from "../../../lib/aspect/python/python2to3";

describe("An aspect distinguishes between Python versions used", () => {
    it("Returns no fingerprint on a project with no python in it", async () => {
        const project = InMemoryProject.of({ path: "README.txt", content: "No Python here" });
        const fingerprints = await PythonVersion.extract(project, undefined);
        assert(!fingerprints, "Expected no fingerprints in a project without python");
    });
});
