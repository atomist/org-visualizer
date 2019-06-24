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

import * as assert from "assert";
import {
    findDependenciesFromRequirements,
    PythonDependency,
} from "../../lib/feature/domain/pythonDependenciesFeature";

describe("parsing requirements.txt", () => {
    it("can see a lib with no specifier", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("nose-cov", all);

        assert(result, "Library not found: nose-cov");
        assert.strictEqual(result.requirementLine, "nose-cov");
    });

    it("can see a lib with a version specifier", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("coverage", all);

        assert(result, "Library not found: coverage");
        assert.strictEqual(result.requirementLine, "coverage!=3.5");
    });

    it("ignores comments", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("nose-that-is-commented-out", all);

        assert(!result);
    });

    it.skip("follows references (I don't expect to implement this)");

    it("Ignores options", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("-r", all);

        assert(!result);
    });

    it("Strips comments from the end of the line", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("coverage", all);

        assert(result, "Library not found: coverage");
        assert.strictEqual(result.requirementLine, "coverage!=3.5");
    });

    it("finds library names with numbers", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("beautifulsoup4", all);

        assert(result, "Library not found: beautifulsoup4");
        assert.strictEqual(result.requirementLine, "beautifulsoup4");
    });

    it("removes spaces", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("coverage", all);

        assert(result, "Library not found: coverage");
        assert.strictEqual(result.requirementLine, "coverage!=3.5");
    });

    it("Combines lines continued with slash", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("Mopidy-Dirble", all);

        assert(result, "Library not found: Mopidy-Dirble");
        assert.strictEqual(result.requirementLine, "Mopidy-Dirble~=1.1");
    });

    it("Includes the environment specifier", () => {
        const all = findDependenciesFromRequirements(sample);
        const result = findByLibraryName("SomeProject", all);

        assert(result, "Library not found: SomeProject");
        assert.strictEqual(result.requirementLine, "SomeProject;sys_platform=='win32'");
    });
});

function findByLibraryName(libraryName: string, pds: PythonDependency[]): PythonDependency | undefined {
    return pds.find(pd => pd.libraryName === libraryName);
}

const sample = `#
####### example-requirements.txt #######
# nose-that-is-commented-out
###### Requirements without Version Specifiers ######
nose
nose-cov
beautifulsoup4
#
###### Requirements with Version Specifiers ######
#   See https://www.python.org/dev/peps/pep-0440/#version-specifiers
docopt == 0.6.1             # Version Matching. Must be version 0.6.1
keyring >= 4.1.1            # Minimum version 4.1.1
coverage != 3.5             # Version Exclusion. Anything except version 3.5
Mopidy-Dirble ~= \
   1.1        # Compatible release. Same as >= 1.1, == 1.*
#
###### Refer to other requirements files ######
-r other-requirements.txt
#
#
###### A particular file ######
./downloads/numpy-1.9.2-cp34-none-win32.whl
http://wxpython.org/Phoenix/snapshot-builds/wxPython_Phoenix-3.0.3.dev1820+49a8884-cp34-none-win_amd64.whl
#
###### Additional Requirements without Version Specifiers ######
#   Same as 1st section, just here to show that you can put things in any order.
rejected
green
# environbment specified should be included
SomeProject; sys_platform == 'win32'
`;
