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

import { Aspect, filesAspect } from "@atomist/sdm-pack-fingerprints";
import { conditionalize } from "../compose/conditionalize";

export const NodeGitIgnore: Aspect =
    conditionalize(filesAspect({
            name: "node-gitignore",
            displayName: "Node git ignore",
            type: "node-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
        ),
        async p => p.hasFile("package.json"));

export const JavaGitIgnore: Aspect =
    conditionalize(filesAspect({
            name: "spring-gitignore",
            displayName: "git ignore",
            type: "spring-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
        ),
        async p => p.hasFile("pom.xml"));
