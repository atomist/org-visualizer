import { featureQueriesFrom } from "./featureQueries";
import { DefaultFeatureManager } from "../feature/DefaultFeatureManager";
import { TypeScriptVersionFeature } from "../feature/TypeScriptVersionFeature";

export const featureManager = new DefaultFeatureManager(
    new TypeScriptVersionFeature(),
    //new NodeLibraryVersionHuckleberry(new NodeLibraryVersion("@atomist/sdm", "2.0.0")),
    //bannedLibraryHuckleberry("axios"),
);
export const featureQueries = featureQueriesFrom(featureManager);