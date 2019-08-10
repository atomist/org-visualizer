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
    PlantedTree,
    SunburstTree,
} from "../../tree/sunburst";
import {
    introduceClassificationLayer,
    visit,
} from "../../tree/treeUtils";

export function splitByOrg(pt: PlantedTree): PlantedTree {
    // Group by organization via an additional layer at the center
    return introduceClassificationLayer<{ owner: string }>(pt,
        {
            descendantClassifier: l => l.owner,
            newLayerDepth: 1,
            newLayerMeaning: "owner",
        });
}

export function addRepositoryViewUrl(tree: SunburstTree): SunburstTree {
    interface RepoNode { viewUrl?: string; url?: string; id: string; }

    visit(tree, l => {
        const rn = l as any as RepoNode;
        if (rn.url && rn.id) {
            // It's an eligible end node
            rn.viewUrl = `/repository?id=${encodeURI(rn.id)}`;
        }
        return true;
    });
    return tree;
}
