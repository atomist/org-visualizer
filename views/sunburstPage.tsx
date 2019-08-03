import * as React from "react";
import { PlantedTree, SunburstCircleMetadata } from "../lib/tree/sunburst";

import * as _ from "lodash";

// tslint:disable-next-line:no-empty-interface
export interface CurrentIdealForDisplay {
    displayValue: string;
}

export interface PossibleIdealForDisplay {
    url?: string;
    fingerprintName: string;
    displayValue: string;
    stringified: string;
}

export interface SunburstPageProps {
    workspaceId: string;
    fingerprintDisplayName: string;
    currentIdeal: CurrentIdealForDisplay;
    possibleIdeals: PossibleIdealForDisplay[];
    query: string;
    dataUrl: string;
    tree: PlantedTree; // we have the data already.

    /**
     * Tags selected
     */
    selectedTags: string[];

}

function displayCurrentIdeal(currentIdeal: CurrentIdealForDisplay): React.ReactElement {
    return <h2>
        Current ideal: {currentIdeal.displayValue}
    </h2>;
}

interface PerLevelDataItem {
    textAreaId: string;
    labelText: string;
}

/* This element will contain the full data value for one level, about the item hovered over. */
function levelDataListItem(item: PerLevelDataItem): React.ReactElement {
    return <li key={"li-" + item.textAreaId}>
        <label htmlFor={item.textAreaId}>{item.labelText}: </label>
        <div className="unfrozenLevelData" id={item.textAreaId}></div>
    </li>;
}

export function SunburstPage(props: SunburstPageProps): React.ReactElement {

    const perLevelDataItems = !props.tree || !props.tree.circles ? []
        : props.tree.circles.map((c, i) => ({ textAreaId: "levelData-" + i, labelText: c.meaning }));

    const d3ScriptCall = `<script>
    const data = ${JSON.stringify(props.tree)};
    SunburstYo.sunburst("${props.workspaceId}",
        data,
        window.innerWidth - 250,
        window.innerHeight - 100,
        [${perLevelDataItems.map(p => `"` + p.textAreaId + `"`).join(",")}]);
    </script>`;

    const thingies: string | React.ReactElement = !props.tree ? "Hover over a slice to see its details" :
        <ul>{perLevelDataItems.map(levelDataListItem)}</ul>;

    const tags: Array<{ name: string, count: number }> = _.sortBy(
        (props.tree as any).tags || [],
        t => -t.count);

    const selectedTagButtons = props.selectedTags
        .map(t => {
            return <form method="GET" action="/query">
                <input type="hidden" name="explore" value="true"/>
                <input type="hidden" name="tags" value={props.selectedTags.filter(x => x !== t).join(",")}/>
                <input type="submit" name={t} value={"-" + t}/>
            </form>;
        });

    const addTagButtons = tags
        .filter(t => !props.selectedTags.includes(t.name))
        .map(t => {
            return <span>
                <form method="GET" action="/query">
                    <input type="hidden" name="explore" value="true"/>
                    <input type="hidden" name="tags" value={props.selectedTags.concat(t.name).join(",")}/>
                    <input type="submit" value={`${t.name} (${t.count})`}/>
                </form>
                <form method="GET" action="/query">
                    <input type="hidden" name="explore" value="true"/>
                    <input type="hidden" name="tags" value={props.selectedTags.concat("!" + t.name).join(",")}/>
                    <input type="submit" value={`NOT ${t.name}`}/>
                </form>
            </span>;
        });

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) : "";
    return <div className="sunburst">
        <h1>{props.fingerprintDisplayName}</h1>

        <h2>{props.selectedTags.map(t => t.replace("!", "not ")).join(" and ") || "All"} - {(props.tree as any).matchingRepoCount} of {(props.tree as any).repoCount} repos</h2>

        <form method="GET" action="/query">
            <input type="hidden" name="explore" value="true"/>
            <input type="submit" value="CLEAR"/>
        </form>

        {selectedTagButtons}

        {addTagButtons}

        {idealDisplay}
        <div className="wrapper">
            <div id="putSvgHere" className="sunburstSvg"></div>
            <div id="dataAboutWhatYouClicked" className="sunburstData">{thingies}</div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }}/>
        <a href={"." + props.dataUrl} type="application/json">Raw data</a>
    </div>;

}
