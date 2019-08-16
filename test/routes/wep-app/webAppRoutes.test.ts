
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
                            type: "npm-project-deps",
                            variants: 23, count: 23, entropy: 3.1354942159291497, size: 23,
                        }, {
                            name: "@types/node", type:
                                "npm-project-deps",
                            variants: 17, count: 17, entropy: 2.833213344056216, size: 17,
                        },
                        {
                            name: "typescript",
                            type: "npm-project-deps", variants: 16, count: 16, entropy: 2.772588722239781, size: 16,
                        }],
                    },
                ],
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
        assert.strictEqual(aspectNodeInThisSampleData.url, "/fingerprint/npm-project-deps",
            "Found url: " + aspectNodeInThisSampleData.url);
    });
});
