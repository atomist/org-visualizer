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
import { License } from "../../lib/aspect/community/license";

import * as assert from "assert";

describe("license aspect", () => {

    it("should find no license", async () => {
        const p = InMemoryProject.of();
        const fp: any = await License.extract(p);
        assert(!!fp.data);
        assert.deepStrictEqual(fp.data, { classification: "None", content: undefined, path: undefined });
    });

    it("should find Apache license at LICENSE", async () => {
        const p = InMemoryProject.of({ path: "LICENSE", content: asl });
        const fp: any = await License.extract(p);
        assert(!!fp.data);
        assert.deepStrictEqual(fp.data, { classification: "Apache License", content: asl, path: "LICENSE" });
    });

    it("should find Apache license at license.txt", async () => {
        const p = InMemoryProject.of({ path: "license.txt", content: asl });
        const fp: any = await License.extract(p);
        assert(!!fp.data);
        assert.deepStrictEqual(fp.data, { classification: "Apache License", content: asl, path: "license.txt" });
    });

});

const asl = `
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.
`;
