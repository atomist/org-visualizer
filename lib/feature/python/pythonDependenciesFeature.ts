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
    Feature,
    FP,
    sha256,
} from "@atomist/sdm-pack-fingerprints";
import { DocumentedFeature } from "../DocumentedFeature";

const PythonDirectDepType = "python-direct-dep";

export interface PythonDependency {
    libraryName: string;
    requirementLine: string;
}

/**
 * Find Python dependencies in requirements.txt
 *
 * Use this to find out what Python dependencies are declared
 * in your project, and what versions are specified.
 *
 * This fingerprints each line that looks like a dependency.
 * The entire line becomes the data of the fingerprint.
 *
 * The displayed value is the whole line, minus the name.
 */
export const pythonDependenciesFeature: Feature & DocumentedFeature = {
    name: PythonDirectDepType,
    displayName: "Python dependencies",
    extract: async p => {
        const requirementsFile = await p.getFile("requirements.txt");
        if (!requirementsFile) {
            return undefined;
        }
        const requirementsFileContent = await requirementsFile.getContent();
        const allDeps = findDependenciesFromRequirements(requirementsFileContent);
        return allDeps.map(depToFingerprint);
    },
    toDisplayableFingerprintName: name => name,
    toDisplayableFingerprint: fp => {
        const version = fp.data.replace(fp.name, "");
        return version;
    },
    documentationUrl:
        "https://atomist-blogs.github.io/org-visualizer/modules/_lib_feature_python_pythondependenciesfeature_.html#pythondependenciesfeature",
};

export function findDependenciesFromRequirements(requirementsTxt: string): PythonDependency[] {
    const r = /^([a-zA-Z0-9][A-Za-z0-9._-]*).*$/mg;
    const results: PythonDependency[] = [];

    let v: string[];
    // tslint:disable-next-line:no-conditional-assignment
    while ((v = r.exec(requirementsTxt)) !== null) {
        // console.log(v[0]);
        const requirementLine = v[0].replace(/\s+#.*$/, "").replace(/\s+/g, "");
        results.push({
            libraryName: v[1],
            requirementLine,
        });
    }
    return results;
}

function depToFingerprint(pd: PythonDependency): FP {
    const data = pd.requirementLine;
    return {
        type: PythonDirectDepType,
        name: pd.libraryName,
        abbreviation: "pydep",
        version: "0.1.0",
        data,
        sha: sha256(data),
    };
}
