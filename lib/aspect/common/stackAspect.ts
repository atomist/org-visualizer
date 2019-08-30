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
import { checkOutArtifact } from "@atomist/sdm";
import { classificationAspect } from "@atomist/sdm-pack-aspect";
import { Aspect } from "@atomist/sdm-pack-fingerprints";

const StackName = "stack";

/**
 * Identify common stacks
 * @type {Aspect<ClassificationData>}
 */
export const StackAspect: Aspect = classificationAspect(
    {
        name: StackName,
        // Deliberately don't display
        displayName: undefined,
        toDisplayableFingerprintName: () => "Technology stack",
    },
    { tags: "jvm", reason: "has Maven POM", test: async p => p.hasFile("pom.xml") },
    { tags: "jvm", reason: "has build.gradle", test: async p => p.hasFile("build.gradle") },
    { tags: "node", reason: "has package.json", test: async p => p.hasFile("package.json") },
    { tags: "python", reason: "has requirements.txt", test: async p => p.hasFile("requirements.txt") },
    {
        tags: "python",
        reason: "has Python files in root",
        test: async p => await projectUtils.countFiles(p, "*.py", async () => true) > 0,
    },
    {
        tags: ["aws", "lambda"], reason: "has Lambda template",
        test: async p => p.hasFile("template.yml"),
    },
);

export const JavaBuild: Aspect = classificationAspect({
        name: "javaBuild",
        displayName: "Java build tool",
        toDisplayableFingerprintName: () => "Java build tool",
    },
    { tags: "maven", reason: "has Maven POM", test: async p => p.hasFile("pom.xml") },
    { tags: "gradle", reason: "has build.gradle", test: async p => p.hasFile("build.gradle") },
);

export const CiAspect: Aspect = classificationAspect({
        name: "ci",
        // Deliberately don't display
        displayName: undefined,
        toDisplayableFingerprintName: () => "CI tool",
    },
    { tags: "travis", reason: "has .travis.yml", test: async p => p.hasFile(".travis.yml") },
    { tags: "jenkins", reason: "has JenkinsFile", test: async p => p.hasFile("Jenkinsfile") },
    {
        tags: "circle",
        reason: "has .circleci/config.yml",
        test: async p => p.hasFile(".circleci/config.yml"),
    },
    { tags: "concourse", reason: "has pipeline.yml", test: async p => p.hasFile("pipeline.yml") },
);
