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

const sampleData = {
    tree: {
        name: "drift",
        children: [
            {
                name: "high",
                children: [
                    {
                        name: "NPM dependencies",
                        type: "npm-project-deps",
                        children: [{
                            name: "@atomist/automation-client",
                            fingerprint_name: "atomist::automation-client",
                            type: "npm-project-deps", variants: 23, count: 23, entropy: 3.1354942159291497, size: 23,
                        }, {
                            name: "@types/node",
                            fingerprint_name: "types::node", type: "npm-project-deps", variants: 17, count: 17, entropy: 2.833213344056216, size: 17,
                        }, {
                            name: "typescript",
                            fingerprint_name: "typescript", type: "npm-project-deps", variants: 16, count: 16, entropy: 2.772588722239781, size: 16,
                        }],
                    }],
            },
        ],
    },
    circles: [
        {
            meaning: "report",
        },
        {
            meaning: "entropy band",
        },
        {
            meaning: "aspect name",
        },
        {
            meaning: "fingerprint name",
        },
    ],
};

import * as assert from "assert";
import * as _ from "lodash";
import { populateLocalURLs } from "../../../lib/routes/web-app/webAppRoutes";

describe("adding URLs to local pages", () => {
    it("Can add the URL to an aspect", async () => {
        const copy = _.cloneDeep(sampleData);
        populateLocalURLs(copy);

        // Any node (with a "type" property) at the level with meaning "aspect name" should get a URL
        // to "/fingerprint/${type}"

        const aspectNodeInThisSampleData = copy.tree.children[0].children[0] as any;

        assert(!(copy.tree as any).url, "This node should not have a URL added");
        assert.strictEqual(aspectNodeInThisSampleData.url, "/fingerprint/npm-project-deps/*",
            "Found url: " + aspectNodeInThisSampleData.url);
    });

    it("Can add the URL to a fingerprint", async () => {
        const copy = _.cloneDeep(sampleData);
        populateLocalURLs(copy);

        // Any node (with a "type" and "fingerprint_name" property) at the level with meaning "fingerprint name" should get a URL
        // to "/fingerprint/${type}/${fingerprint_name}"

        const fingerprintNodesInThisSampleData = copy.tree.children[0].children[0].children as any[];

        fingerprintNodesInThisSampleData.forEach(n =>
            assert.strictEqual(n.url, `/fingerprint/npm-project-deps/${encodeURIComponent(n.fingerprint_name)}`,
                `Found url: ${n.url} for ${n.name}`));
    });
});
