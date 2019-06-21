import { Feature } from "@atomist/sdm-pack-fingerprints";
import { classifyFeature } from "./classifyFeature";

const StackName = "stack";

export const stackFeature: Feature = classifyFeature({
        name: StackName,
        displayName: "stack",
        fallbackClassification: "unknown",
    },
    { classification: "jvm", predicate: async p => await p.hasFile("pom.xml") },
    { classification: "jvm", predicate: async p => await p.hasFile("build.gradle") },
    { classification: "node", predicate: async p => await p.hasFile("package.json") },
    { classification: "python", predicate: async p => await p.hasFile("requirements.txt") },
);

export const javaBuildFeature: Feature = classifyFeature({
        name: "javaBuild",
        displayName: "javaBuild",
        fallbackClassification: "non-Java",
    },
    { classification: "maven", predicate: async p => await p.hasFile("pom.xml") },
    { classification: "gradle", predicate: async p => await p.hasFile("build.gradle") },
);

export const ciFeature: Feature = classifyFeature({
        name: "ci",
        displayName: "ci",
        fallbackClassification: undefined,
    },
    { classification: "travis", predicate: async p => await p.hasFile(".travis.yml") },
    { classification: "jenkins", predicate: async p => await p.hasFile("Jenkinsfile") },
    { classification: "circle", predicate: async p => await p.hasFile(".circleci/config.yml") },
    { classification: "concourse", predicate: async p => await p.hasFile("pipeline.yml") },
);