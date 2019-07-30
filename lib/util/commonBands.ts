import { Bands, Default } from "./bands";

export type SizeBands = "low" | "medium" | "high";

export type AgeBands = "current" | "recent" | "ancient" | "prehistoric";

export const EntropySizeBands: Bands<SizeBands | "zero"> = {
    zero: { exactly: 0 },
    low: { upTo: 1 },
    medium: { upTo: 2 },
    high: Default,
};
