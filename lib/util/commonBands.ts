import { Bands, Default } from "./bands";

export type SizeBands = "zero" | "low" | "medium" | "high";

export type AgeBands = "modern" | "medieval" | "ancient" | "prehistoric";

export const EntropySizeBands: Bands<SizeBands> = {
    zero: { exactly: 0 },
    low: { upTo: 1 },
    medium: { upTo: 2 },
    high: Default,
};
