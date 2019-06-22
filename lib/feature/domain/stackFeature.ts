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

import { Feature } from "@atomist/sdm-pack-fingerprints";
import { classifyFeature } from "./classifyFeature";

const StackName = "stack";

export const stackFeature: Feature = classifyFeature({
        name: StackName,
        displayName: "stack",
        fallbackClassification: "unknown",
    },
    { classification: "jvm", predicate: async p => p.hasFile("pom.xml") },
    { classification: "jvm", predicate: async p => p.hasFile("build.gradle") },
    { classification: "node", predicate: async p => p.hasFile("package.json") },
    { classification: "python", predicate: async p => p.hasFile("requirements.txt") },
);

export const javaBuildFeature: Feature = classifyFeature({
        name: "javaBuild",
        displayName: "javaBuild",
        fallbackClassification: "non-Java",
    },
    { classification: "maven", predicate: async p => p.hasFile("pom.xml") },
    { classification: "gradle", predicate: async p => p.hasFile("build.gradle") },
);

export const ciFeature: Feature = classifyFeature({
        name: "ci",
        displayName: "ci",
        fallbackClassification: undefined,
    },
    { classification: "travis", predicate: async p => p.hasFile(".travis.yml") },
    { classification: "jenkins", predicate: async p => p.hasFile("Jenkinsfile") },
    { classification: "circle", predicate: async p => p.hasFile(".circleci/config.yml") },
    { classification: "concourse", predicate: async p => p.hasFile("pipeline.yml") },
);
