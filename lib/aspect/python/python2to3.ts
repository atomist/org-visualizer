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

import {
    Project,
    projectUtils,
    RegexFileParser,
} from "@atomist/automation-client";
import { matchIterator } from "@atomist/automation-client/lib/tree/ast/astUtils";
import { projectClassificationAspect } from "@atomist/sdm-pack-aspect";

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
        tags: "python2", reason: "Uses python2 print syntax", test: async p => containsRegex(p, ["**/*.py"], /^\s*print\s*["'<]/m),

    },
    {
        tags: "python-version-unknown", reason: "We couldn't figure out which", test: async p => true,
    });

async function containsRegex(project: Project, globPatterns: string[], regex: RegExp): Promise<boolean> {
    const parser = new RegexFileParser({
        rootName: "whatevers",
        matchName: "whatever",
        regex,
        captureGroupNames: ["name"],
    });
    const it = matchIterator<{ name: string }>(project, {
        parseWith: parser,
        globPatterns,
        pathExpression: "//whatevers/whatever",
    });
    for await (const anything of it) {
        return true;
    }
    return false;
}
