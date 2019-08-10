import { PlantedTree, SunburstTree } from "../../tree/sunburst";
import { introduceClassificationLayer, visit } from "../../tree/treeUtils";

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
