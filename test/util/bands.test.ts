import { bandFor, Bands, Default } from "../../lib/util/bands";

import * as assert from "assert";

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
        assert.strictEqual(bandFor(bands, 0.5, true), "gotcha (=0.5)");
        assert.strictEqual(bandFor(bands, 0.6, true), "low (<1)");
        assert.strictEqual(bandFor(bands, 25, true), "speckled");
    });

});
