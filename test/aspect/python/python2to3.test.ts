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

import { InMemoryProject } from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import * as assert from "assert";
import { hasPython2Dependencies, PythonVersion } from "../../../lib/aspect/python/python2to3";

describe("An aspect distinguishes between Python versions used", () => {
    it("Returns no fingerprint on a project with no python in it", async () => {
        const project = InMemoryProject.of({ path: "README.txt", content: "No Python here" });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1);
        assert.deepStrictEqual(fingerprints[0].data.tags, ["pythonless"]);
    });

    it("Defaults to indeterminate", async () => {
        const project = InMemoryProject.of({ path: "something.py", content: "" });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1);
        assert.deepStrictEqual(fingerprints[0].data.tags, ["python-version-unknown"]);
    });

    // note: we are looking for setup.py only in the root
    // we could make a virtual project finder to find multiple ones in a repo
    it("Recognizes a python 3 classifier in setup.py", async () => {
        const project = InMemoryProject.of({
            path: "setup.py", content: setupDotPy(["Programming Language :: Python :: 3"]),
        });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1, "There should be one fingerprint");
        assert.deepStrictEqual(fingerprints[0].data.tags, ["python3"], "Wrong tag");
    });

    it("Does not recognize a setup.py without a language number classifier", async () => {
        const project = InMemoryProject.of({
            path: "setup.py", content: setupDotPy([]),
        });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1, "There should be one fingerprint");
        assert.deepStrictEqual(fingerprints[0].data.tags, ["python-version-unknown"], "Wrong tag");
    });

    it("Given both Python 2 and 3 classifiers, calls it Python 3", async () => {
        // we could choose to tag this with both.
        // We could distinguish between Python 3 only, vs possibly both
        const project = InMemoryProject.of({
            path: "setup.py", content: setupDotPy(["Programming Language :: Python :: 3.6",
                "Programming Language :: Python :: 2.7"]),
        });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1, "There should be one fingerprint");
        assert.deepStrictEqual(fingerprints[0].data.tags, ["python3"], "Wrong tag");
    });

    it("Given a Python 2 classifiers, calls it Python 2", async () => {
        // we could choose to tag this with both.
        // We could distinguish between Python 3 only, vs possibly both
        const project = InMemoryProject.of({
            path: "setup.py", content: setupDotPy(["Programming Language :: Python :: 2.7"]),
        });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1, "There should be one fingerprint");
        assert.deepStrictEqual(fingerprints[0].data.tags, ["python2"], "Wrong tag");
    });

    async function inspectPythonCode(code: string, expectedTag: string) {
        const project = InMemoryProject.of({
            path: "something.py", content: code,
        });
        const fingerprints = toArray(await PythonVersion.extract(project, undefined));
        assert.strictEqual(fingerprints.length, 1, "There should be one fingerprint");
        assert.deepStrictEqual(fingerprints[0].data.tags, [expectedTag], "Wrong tag");
    }

    it("Identifies the Python 2 print statement", async () => {
        await inspectPythonCode(`
# blah blah
print "Hello world"
# blah blah`, "python2");
    });

    it("Identifies the Python 2 print statement with single quotes", async () => {
        await inspectPythonCode(`
# blah blah
print 'Hello world'
# blah blah`, "python2");
    });

    it("Does not identify a string about the Python 2 print statement", async () => {
        await inspectPythonCode(`
# blah blah
print("In Python2 you would say: print ")
# blah blah`, "python-version-unknown");
    });

    it("Identifies a Python 2 print to stderr", async () => {
        await inspectPythonCode(`
# blah blah
print << sys.stderr, 'I hate you'
# blah blah`, "python2");
    });

    it("Notices old exception syntax", async () => {
        await inspectPythonCode(`
# blah blah
raise ValueError, "dodgy value"
# blah blah`, "python2");
    });

    it("Is OK with Python 3 exception syntax", async () => {
        await inspectPythonCode(`
# blah blah
raise ValueError("dodgy value")
# blah blah`, "python-version-unknown");
    });

    it("Recognizes Python3-only raise syntax", async () => {
        await inspectPythonCode(`
# blah blah
raise ValueError("dodgy value").with_traceback()
# blah blah`, "python3");
    });

    it("Recognizes Python3-only raise-from syntax", async () => {
        await inspectPythonCode(`
# Python 3 only
class FileDatabase:
    def __init__(self, filename):
        try:
            self.file = open(filename)
        except IOError as exc:
            raise DatabaseError('failed to open') from exc
# blah blah`, "python3");
    });

    // These tests come from: http://python-future.org/compatible_idioms.html
    // there are more we could implement, they're not hard.

});

function setupDotPy(classifiers: string[]): string {
    return `from setuptools import setup, find_packages
import io
from os import path
import re


VERSION = re.search("VERSION = '([^']+)'", io.open(
    path.join(path.dirname(__file__), 'webencodings', '__init__.py'),
    encoding='utf-8'
).read().strip()).group(1)

LONG_DESCRIPTION = io.open(
    path.join(path.dirname(__file__), 'README.rst'),
    encoding='utf-8'
).read()


setup(
    name='whatever',
    version=VERSION,
    url='https://github.com/some/example',
    license='BSD',
    author='Yes',
    author_email='yo@exyr.org',
    description='I love projects',
    long_description=LONG_DESCRIPTION,
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python${classifiers.join(`',
        '`)}',
        'Programming Language :: Python :: Implementation :: CPython',
        'Programming Language :: Python :: Implementation :: PyPy',
        'Topic :: Internet :: WWW/HTTP',
    ],
    packages=find_packages(),
)`;
}

describe("determining python version from a utility", () => {
    it("does not fail miserably when caniusepython3 is not there", async () => {
        const p = InMemoryProject.of({
            path: "requirements.txt", content: `flake8
pytest-docker-pexpect
twine` });
        const result = await hasPython2Dependencies(p, "thisdoesnotexist");
        assert(!result, "go with no when we can't run it");
    });
});
