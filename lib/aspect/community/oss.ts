import { globAspect } from "../compose/globAspect";
import { Aspect } from "@atomist/sdm-pack-fingerprints";

export const ChangelogAspect: Aspect =
    globAspect({
        name: "changelog",
        displayName: undefined,
        glob: "CHANGELOG.md",
    });

export const ContributingAspect: Aspect =
    globAspect({ name: "contributing", displayName: undefined, glob: "CONTRIBUTING.md" });