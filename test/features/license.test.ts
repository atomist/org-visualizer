import { InMemoryProject } from "@atomist/automation-client";
import { License } from "../../lib/feature/community/license";
import { FP } from "@atomist/sdm-pack-fingerprints/lib/machine/Feature";

import * as assert from "assert";

describe("license aspect", () => {

    it("should find no license", async () => {
        const p = InMemoryProject.of();
        const fp = await License.extract(p) as FP;
        assert(!!fp.data);
        assert.deepStrictEqual(fp.data, { classification: "None", content: undefined });
    });

    it("should find Apache license", async () => {
        const p = InMemoryProject.of({ path: "LICENSE", content: asl });
        const fp = await License.extract(p) as FP;
        assert(!!fp.data);
        assert.deepStrictEqual(fp.data, { classification: "Apache License", content: asl });
    });

});

const asl = `
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.
`;
