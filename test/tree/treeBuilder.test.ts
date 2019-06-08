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

import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import * as assert from "power-assert";
import { FileSystemProjectAnalysisResultStore } from "../../lib/analysis/offline/persist/FileSystemProjectAnalysisResultStore";
import { DefaultProjectAnalysisRenderer } from "../../lib/feature/support/groupingUtils";
import { treeBuilder } from "../../lib/tree/TreeBuilder";

// Works only on spidered data
describe.skip("treeBuilder", () => {

    it("renders single level", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);
        const builder = treeBuilder<ProjectAnalysis>("root")
            .renderWith(DefaultProjectAnalysisRenderer);
        const t = builder.toSunburstTree(() => all);
    });

    it("renders and groups analyses", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "foo", by: ar => ar.id.owner })
            .renderWith(DefaultProjectAnalysisRenderer);
        const t = builder.toSunburstTree(() => all);
    });

    it("renders and groups not excluding other", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "foo", by: ar => ar.id.repo.length > 8 ? "foo" : "a" })
            .renderWith(DefaultProjectAnalysisRenderer);
        const t = await builder.toSunburstTree(() => all);
        assert.strictEqual(t.children.length, 2);
        assert.strictEqual(t.children.filter(c => c.name === "foo").length, 1);
    });

    it("renders and groups excluding other", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "foo", by: ar => ar.id.repo.length > 8 ? undefined : "a" })
            .renderWith(DefaultProjectAnalysisRenderer);
        const t = await builder.toSunburstTree(() => all);
        assert.strictEqual(t.children.length, 1);
    });

    it("transforms and renders", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "foo", by: ar => ar.id.owner })
            .map<number>({ mapping:
                    async function*(ars) { for await (const ar of ars) { yield ar.dependencies.length}}})
            .renderWith(num => ({
                name: num + "",
                size: num,
            }));
        const t = builder.toSunburstTree(() => all);
    });

    it("transforms and renders with split", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "foo", by: ar => ar.id.owner })
            .split<string>({splitter: ar => ar.dependencies.map(d => d.artifact), namer: () => "y"})
            .renderWith(artifact => ({
                name: artifact,
                size: 1,
            }));
        const t = builder.toSunburstTree(() => [all[0]]);
    });

    it("transforms and splits before grouping", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "foo", by: ar => ar.id.owner })
            .split<string>({ splitter: ar => ar.dependencies.map(d => d.artifact), namer: a => "x"})
            .group({ name: "length", by: a => a.length > 5 ? "long" : "short"})
            .renderWith(artifact => ({
                name: artifact,
                size: 1,
            }));
        const t = builder.toSunburstTree(() => [all[0]]);
    });

    it("adds customGroup layer", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "foo", by: ar => ar.id.owner })
            .customGroup<number>({
                name: "thing",
                to: () => {
                    return {
                        name: [1, 2, 3],
                    };
                },
            })
            .renderWith(num => ({
                name: num + "",
                size: num,
            }));
        const t = builder.toSunburstTree(() => all);
    });

    it("flattens single layer", async () => {
        const all = (await new FileSystemProjectAnalysisResultStore().loadWhere()).map(r => r.analysis);

        const builder = treeBuilder<ProjectAnalysis>("root")
            .group({ name: "thing", by: () => "foo", flattenSingle: true })
            .group({ name: "foo", by: ar => ar.id.url.length + "" })
            .renderWith(DefaultProjectAnalysisRenderer);
        const t = await builder.toSunburstTree(() => all);
        assert(t.children.length > 1);
    });

});
