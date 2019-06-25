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

import { projectUtils } from "@atomist/automation-client";
import { Feature } from "@atomist/sdm-pack-fingerprints";
import { classificationFeature } from "../compose/classificationFeature";

const StackName = "stack";

export const stackFeature: Feature = classificationFeature({
        name: StackName,
        displayName: "Technology stack",
        toDisplayableFingerprintName: () => "Technology stack",
        allowMulti: true,
    },
    { classification: "jvm", reason: "has Maven POM", predicate: async p => p.hasFile("pom.xml") },
    { classification: "jvm", reason: "has build.gradle", predicate: async p => p.hasFile("build.gradle") },
    { classification: "node", reason: "has package.json", predicate: async p => p.hasFile("package.json") },
    { classification: "python", reason: "has requirements.txt", predicate: async p => p.hasFile("requirements.txt") },
    {
        classification: "python",
        reason: "has Python files in root",
        predicate: async p => await projectUtils.countFiles(p, "*.py", async () => true) > 0,
    },
    {
        classification: ["aws", "lambda"], reason: "has Lambda template",
        predicate: async p => p.hasFile("template.yml"),
    },
);

export const javaBuildFeature: Feature = classificationFeature({
        name: "javaBuild",
        displayName: "Java build tool",
        toDisplayableFingerprintName: () => "Java build tool",
    },
    { classification: "maven", reason: "has Maven POM", predicate: async p => p.hasFile("pom.xml") },
    { classification: "gradle", reason: "has build.gradle", predicate: async p => p.hasFile("build.gradle") },
);

export const ciFeature: Feature = classificationFeature({
        name: "ci",
        displayName: "CI tool",
        toDisplayableFingerprintName: () => "CI tool",
    },
    { classification: "travis", reason: "has .travis.yml", predicate: async p => p.hasFile(".travis.yml") },
    { classification: "jenkins", reason: "has JenkinsFile", predicate: async p => p.hasFile("Jenkinsfile") },
    {
        classification: "circle",
        reason: "has .circleci/config.yml",
        predicate: async p => p.hasFile(".circleci/config.yml"),
    },
    { classification: "concourse", reason: "has pipeline.yml", predicate: async p => p.hasFile("pipeline.yml") },
);
