import { Feature } from "@atomist/sdm-pack-fingerprints";

const FeatureCategories: Record<string, string[]> = {};

/**
 * Store a categories for a given Features
 */
export function registerCategory(feature: Feature<any>, ...categories: string[]): void {
    FeatureCategories[feature.name] = categories;
}

/**
 * Retrieve categories or undefined for a given Feature
 */
export function getCategory(feature: Feature<any>): string[] | undefined {
    return FeatureCategories[feature.name];
}
