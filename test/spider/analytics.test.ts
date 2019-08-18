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

import { analyzeCohort } from "../../lib/analysis/offline/spider/analytics";

import * as assert from "assert";

describe("analyzeCohort", () => {

    it("should analyze none", () => {
        const fps = [];
        const a = analyzeCohort(fps);
        assert.strictEqual(a.count, 0);
        assert.strictEqual(a.variants, 0);
    });

    it("should analyze one", () => {
        const fps = [{ sha: "abc" }];
        const a = analyzeCohort(fps as any);
        assert.strictEqual(a.count, 1);
        assert.strictEqual(a.variants, 1);
    });

    it("should analyze two different", () => {
        const fps = [{ sha: "abc" }, { sha: "bbc" }];
        const a = analyzeCohort(fps as any);
        assert.strictEqual(a.count, 2);
        assert.strictEqual(a.variants, 2);
    });

    it("should analyze three", () => {
        const fps = [{ sha: "abc" }, { sha: "bbc" }, { sha: "abc" }];
        const a = analyzeCohort(fps as any);
        assert.strictEqual(a.count, 3);
        assert.strictEqual(a.variants, 2);
    });

});
