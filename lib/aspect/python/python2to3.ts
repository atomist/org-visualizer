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
import { projectClassificationAspect } from "@atomist/sdm-pack-aspect";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprint";
interface PythonVersionData {
    version: "2" | "3" | "indeterminate";
}

const PythonVersionAspectName = "PythonVersion";

export const PythonVersion = projectClassificationAspect({
    name: PythonVersionAspectName,
    displayName: "Python 2 or 3",
    stopAtFirst: true,
}, {
        tags: "pythonless", reason: "No Python files in project", test: async p => {
            return !(await projectUtils.fileExists(p, "**/*.py"));
        },
    },
    {
        tags: "python-version-unknown", reason: "We couldn't figure out which", test: async p => true,
    });
