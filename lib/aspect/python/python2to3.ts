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
    GitProject,
    logger,
    Project,
    projectUtils,
    RegexFileParser,
} from "@atomist/automation-client";
import { matchIterator } from "@atomist/automation-client/lib/tree/ast/astUtils";
import { execPromise, ExecPromiseError } from "@atomist/sdm";
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
        tags: "python3", reason: "Declares Python 3 classifier", test: async p => containsRegex(p, ["setup.py"], /Programming Language :: Python :: 3/m),
    },
    {
        tags: "python2", reason: "Declares only Python 2 classifier", test: async p => containsRegex(p, ["setup.py"], /Programming Language :: Python :: 2/m),
    },
    {
        tags: "python2", reason: "Uses Python 2 print syntax", test: async p => containsRegex(p, ["**/*.py"], /^\s*print\s+["'<]/m),
    },
    {
        tags: "python2", reason: "Uses Python 2 raise exception syntax", test: async p => containsRegex(p, ["**/*.py"], /^\s*raise\s+[A-Za-z]+\s*,/m),
    },
    {
        tags: "python3", reason: "Uses Python 3 traceback syntax", test: async p => containsRegex(p, ["**/*.py"], /^\s*raise.*\.with_traceback\(\)/m),
    },
    {
        tags: "python3", reason: "Uses Python 3 raise-from syntax", test: async p => containsRegex(p, ["**/*.py"], /^\s*raise.*\) from /m),
    },
    {
        // tslint:disable-next-line:no-unnecessary-callback-wrapper
        tags: "python2", reason: "Python 2 dependencies found", test: p => hasPython2Dependencies(p),
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

export async function hasPython2Dependencies(p: Project, programToRun: string = "caniusepython3"): Promise<boolean> {
    const hasRequirementsFile = await p.hasFile("requirements.txt");
    if (!hasRequirementsFile) {
        return false;
    }
    try {
        await execPromise(programToRun, ["-r", "requirements.txt"], { cwd: (p as GitProject).baseDir });
        return false;
    } catch (e) {
        const epe: ExecPromiseError = e;
        if (epe.stdout.includes("You need")) {
            logger.debug("Python 2 deps recognized: " + epe.stdout);
            return true;
        }
        logger.debug(`Warning: other failure running ${programToRun}: ` + epe.stderr);
    }
}
