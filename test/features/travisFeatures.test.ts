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
import * as assert from "assert";
import { travisScanner } from "../../lib/feature/travis/travisFeatures";

describe("travis features", () => {

    it("should return undefined if no travis file", async () => {
        const p = InMemoryProject.of();
        const scanned = await travisScanner(p);
        assert.strictEqual(scanned, undefined);
    });

    it("should find no scripts", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: simpleTravis,
        });
        const scanned = await travisScanner(p);
        assert.deepStrictEqual(scanned.services, {});
        assert.deepStrictEqual(scanned.scripts, []);
    });

    it("should find single script", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: singleScriptTravis,
        });
        const scanned = await travisScanner(p);
        assert.deepStrictEqual(scanned.scripts, ["npm start test"]);
    });

    it("should find scripts", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: servicesTravis,
        });
        const scanned = await travisScanner(p);
        assert.deepStrictEqual(scanned.scripts, [
            "npm start test",
            "npm start test.integration",
            "npm start test.e2e",
            "npm start build",
        ]);
    });

    it("should find services", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: servicesTravis,
        });
        const scanned = await travisScanner(p);
        assert.deepStrictEqual(scanned.services, {
            riak: {},
            rabbitmq: {},
            memcached: {},
        });
    });

    it("should find services in JSON", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: travisJson,
        });
        const scanned = await travisScanner(p);
        assert.deepStrictEqual(scanned.services, {
            mongodb: {},
        });
    });

    it("should handle lifecycle", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: notifications,
        });
        const scanned = await travisScanner(p);
        assert.deepStrictEqual(scanned.services, {});
        assert.strictEqual(scanned.scripts.length, 3);
        assert.deepStrictEqual(scanned.afterSuccess, ["npm run coveralls"]);
        assert.deepStrictEqual(scanned.env, {});
    });

    it("should handle env", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: withEnv,
        });
        const scanned = await travisScanner(p);
        assert.deepStrictEqual(scanned.services, {});
        assert.deepStrictEqual(scanned.env, {
            DB: "postgres",
            SH: "bash",
            PACKAGE_VERSION: "1.0.*",
        });
        assert(!scanned.addons);
    });

    it("should note presence of addons", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: addons,
        });
        const scanned = await travisScanner(p);
        assert(!!scanned.addons);
    });

    it("should save before_install", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: satchelJsYaml,
        });
        const scanned = await travisScanner(p);
        assert(!!scanned.beforeInstall);
        assert.strictEqual(scanned.beforeInstall.length, 2);
        const expectedScripts = [
            "npm config set spin false",
            "npm i -g makeshift && makeshift -r https://registry.npmjs.org",
        ];
        assert.deepStrictEqual(scanned.beforeInstall, expectedScripts);
    });

    it("should find no node_js", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: jdkYaml,
        });
        const scanned = await travisScanner(p);
        assert.strictEqual(scanned.nodeJs.length, 0);
    });

    it("should find single node_js", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: simpleTravis,
        });
        const scanned = await travisScanner(p);
        assert(!!scanned.nodeJs);
        assert.deepStrictEqual(scanned.nodeJs, [ "8.9.4"]);
    });

    it("should find multiple node_js", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: notifications,
        });
        const scanned = await travisScanner(p);
        assert(!!scanned.nodeJs);
        assert.deepStrictEqual(scanned.nodeJs, [ "node", "lts/*"]);
    });

    it("should not find branch rules unless specified", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: notifications,
        });
        const scanned = await travisScanner(p);
        assert(!scanned.branches);
    });

    it("should find branch rules when only specified", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: onlyBranchYml,
        });
        const scanned = await travisScanner(p);
        assert(!!scanned.branches);
        assert.deepStrictEqual(scanned.branches.only, [ "master", "stable"]);
    });

    it("should find branch rules when except specified", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: exceptBranchYml,
        });
        const scanned = await travisScanner(p);
        assert(!!scanned.branches);
        assert.deepStrictEqual(scanned.branches.except, [ "legacy", "experimental"]);
    });

    // TODO this appears to be legal. See https://docs.travis-ci.com/user/customizing-the-build/#building-specific-branches
    // But it's not getting merged after parsing
    it.skip("should find branch rules when both only and except specified", async () => {
        const p = InMemoryProject.of({
            path: ".travis.yml",
            content: bothBranchesYml,
        });
        const scanned = await travisScanner(p);
        assert(!!scanned.branches);
        assert.deepStrictEqual(scanned.branches.except, [ "legacy", "experimental"]);
        assert.deepStrictEqual(scanned.branches.only, [ "master", "stable"]);
    });

});

const simpleTravis = `language: node_js
node_js:
  - "8.9.4"
`;

const withEnv = `language: node_js
node_js:
  - "8.9.4"

env:
  - DB=postgres
  - SH=bash
  - PACKAGE_VERSION="1.0.*"`;

const singleScriptTravis = `language: node_js
script: npm start test
`;

const servicesTravis = `language: node_js
node_js:
  - "8.9.4"
install:
  - yarn install
env:
  - DB_TYPE="sqlite" DB_DATABASE="./mydb.sql" DB_LOGGING=false
services:
  - riak
  - rabbitmq
  - memcached
script:
  - npm start test
  - npm start test.integration
  - npm start test.e2e
  - npm start build
notifications:
  email: false`;

const notifications = `language: node_js

node_js:
  - 'node'
  - 'lts/*'

script:
  - node ./internals/scripts/generate-templates-for-linting
  - npm test -- --maxWorkers=4
  - npm run build

before_install:
  - export CHROME_BIN=chromium-browser
  - export DISPLAY=:99.0
  - sh -e /etc/init.d/xvfb start

notifications:
  email:
    on_failure: change

after_success: 'npm run coveralls'

cache:
  directories:
    - node_modules`;

const addons = `language: node_js

addons:
  firefox: "17.0"
`;

// Yes this is legal, as .travis.yml
const travisJson = `{
  "language": "node_js",
  "node_js": "8",
  "services": [
    "mongodb"
  ],
  "script": [
    "npm run build",
    "npm run test"
  ]
}`;

// From MSFT GitHub satcheljs
const satchelJsYaml = `language: node_js
node_js:
- "node"
before_install:
- npm config set spin false
- npm i -g makeshift && makeshift -r https://registry.npmjs.org
install:
- yarn
script:
- |
  if [ -n "$TRAVIS_TAG" ]; then
    npm run build
  fi
- |
  if [ "$TRAVIS_PULL_REQUEST" = "true" ]; then
    bash npm run test
  fi
deploy:
  - provider: npm
    skip_cleanup: true
    email: kchau@microsoft.com
    api_key: $NPM_TOKEN
    tag: latest
    on:
      tags: true
      condition: >
        "$TRAVIS_TAG" != *"-"*
  - provider: npm
    skip_cleanup: true
    email: kchau@microsoft.com
    api_key: $NPM_TOKEN
    tag: next
    on:
      tags: true
      condition: >
        "$TRAVIS_TAG" == *"-"*`;

const jdkYaml = `jdk:
  - oraclejdk8
  - oraclejdk9
  - openjdk8`;

const onlyBranchYml = `
# safelist
branches:
  only:
  - master
  - stable`;

const exceptBranchYml = `
branches:
  except:
  - legacy
  - experimental`;

const bothBranchesYml = `# blocklist
branches:
  except:
  - legacy
  - experimental

# safelist
branches:
  only:
  - master
  - stable`;
