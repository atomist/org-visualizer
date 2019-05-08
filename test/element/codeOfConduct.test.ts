import { InMemoryProject } from "@atomist/automation-client";
import { CodeOfConductScanner } from "../../lib/element/codeOfConduct";
import * as assert from "power-assert";

describe("codeOfConductScanner", () => {

    it("should find no code of conduct", async () => {
        const p = InMemoryProject.of();
        const s = await CodeOfConductScanner(p, undefined, undefined, undefined);
        assert(!s);
    });

    it("should find test code of conduct", async () => {
        const p = InMemoryProject.of({ path: "CODE_OF_CONDUCT.md", content: testCoC });
        const s = await CodeOfConductScanner(p, undefined, undefined, undefined);
        assert(!!s);
        assert.strictEqual(s.content, testCoC);
        assert.strictEqual(s.title, "The Benign Code of Conduct");
    });

    it("should do its best with code of conduct without title", async () => {
        const p = InMemoryProject.of({ path: "CODE_OF_CONDUCT.md", content: "meaningless" });
        const s = await CodeOfConductScanner(p, undefined, undefined, undefined);
        assert(!!s);
        assert.strictEqual(s.content, "meaningless");
        assert(!s.title);
    });

});

const testCoC = `# The Benign Code of Conduct

Be nice`;
