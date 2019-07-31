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
    BandCasing,
    bandFor,
    Bands,
    Default,
} from "../../lib/util/bands";

describe("bands", () => {

    it("should use default band", () => {
        const bands: Bands<"speckled"> = {
            speckled: Default,
        };
        assert.strictEqual(bandFor(bands, 25), "speckled");
    });

    it("should use exactly and default band", () => {
        const bands: Bands<"gotcha" | "speckled"> = {
            gotcha: { exactly: 0.5 },
            speckled: Default,
        };
        assert.strictEqual(bandFor(bands, 0.5), "gotcha");
        assert.strictEqual(bandFor(bands, 25), "speckled");
    });

    it("should use exactly and upTo and default band", () => {
        const bands: Bands<"gotcha" | "low" | "speckled"> = {
            gotcha: { exactly: 0.5 },
            low: { upTo: 25 },
            speckled: Default,
        };
        assert.strictEqual(bandFor(bands, 0), "low");
        assert.strictEqual(bandFor(bands, 0.5), "gotcha");
        assert.strictEqual(bandFor(bands, 11), "low");
        assert.strictEqual(bandFor(bands, 16), "low");
        assert.strictEqual(bandFor(bands, 25), "speckled");
    });

    it("should use exactly and upTo and default band with different order", () => {
        const bands: Bands<"gotcha" | "low" | "speckled" | "other"> = {
            gotcha: { exactly: 0.5 },
            other: { upTo: 100 },
            low: { upTo: 25 },
            speckled: Default,
        };
        assert.strictEqual(bandFor(bands, 0), "low");
        assert.strictEqual(bandFor(bands, 0.5), "gotcha");
        assert.strictEqual(bandFor(bands, 11), "low");
        assert.strictEqual(bandFor(bands, 16), "low");
        assert.strictEqual(bandFor(bands, 25), "other");
        assert.strictEqual(bandFor(bands, 250), "speckled");
    });

    it("should include number", () => {
        const bands: Bands<"gotcha" | "speckled" | "low"> = {
            gotcha: { exactly: 0.5 },
            low: { upTo: 1 },
            speckled: Default,
        };
        assert.strictEqual(bandFor(bands, 0.5, { includeNumber: true }), "gotcha (=0.5)");
        assert.strictEqual(bandFor(bands, 0.6, { includeNumber: true }), "low (<1)");
        assert.strictEqual(bandFor(bands, 25, { includeNumber: true }), "speckled");
    });

    it("should include number and correct case", () => {
        const bands: Bands<"gotcha" | "speckled" | "low"> = {
            gotcha: { exactly: 0.5 },
            low: { upTo: 1 },
            speckled: Default,
        };
        assert.strictEqual(bandFor(bands, 0.5, { includeNumber: true, casing: BandCasing.Sentence }), "Gotcha (=0.5)");
        assert.strictEqual(bandFor(bands, 0.6, { includeNumber: true }), "low (<1)");
        assert.strictEqual(bandFor(bands, 25, { includeNumber: true, casing: BandCasing.Sentence }), "Speckled");
    });

});
