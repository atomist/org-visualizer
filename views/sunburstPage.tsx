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

function displayTagGroup(tagGroup: TagGroup): React.ReactElement {
    return <div>
        {tagGroup.allTagNames().map(n => displayTagButtons(tagGroup, n))}
    </div>;
}

function displayTagButtons(tagGroup: TagGroup, tagName: string): React.ReactElement {
    return <div className={"tagGroup " +
        (tagGroup.isRequired(tagName) ? "requiredTag " : "") +
        (tagGroup.isExcluded(tagName) ? "excludedTag" : "")}>
        <span className="tagDescription">{tagName}</span>
        <form method="GET" action="/query">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={tagGroup.tagSelectionForRequire(tagName).join(",")} />
            <input className="requireButton" type="submit" value="Yes please" title={tagGroup.describeRequire(tagName)}></input>
        </form>
        <form method="GET" action="/query">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={tagGroup.tagSelectionForExclude(tagName).join(",")} />
            <input className="excludeButton" type="submit" value="Please no" alt="alt text" title={tagGroup.describeExclude(tagName)} />
        </form>
    </div>;
}

export class TagGroup {

    private readonly tagsInData: Array<{ name: string, count: number }>;
    constructor(private readonly tagSelection: string[],
                private readonly treeWithTags?: { tags?: Array<{ name: string, count: number }> }) {
        this.tagsInData = treeWithTags && treeWithTags.tags ? treeWithTags.tags : [];
    }

    public allTagNames(): string[] {
        const tagsFromData = this.tagsInData.map(t => t.name);
        const tagsFromSelection = this.tagSelection.map(this.dontFeelExcluded);
        return _.uniq([...tagsFromSelection, ...tagsFromData]);
    }

    public isRequired(tagName: string): boolean {
        return this.tagSelection.includes(tagName);
    }

    public isExcluded(tagName: string): boolean {
        return this.tagSelection.includes(this.pleaseExclude(tagName));
    }

    public describeExclude(tagName: string): string {
        if (this.isRequired(tagName)) {
            return `Switch to excluding ${tagName} projects`;
        }
        if (this.isExcluded(tagName)) {
            return `Currently excluding ${tagName} projects`;
        }
        return `Exclude ${tagName} projects`;
    }

    public describeRequire(tagName: string): string {
        if (this.isRequired(tagName)) {
            return `Currently showing only ${tagName} projects`;
        }
        const dataTag = this.tagsInData.find(t => t.name === tagName);
        if (dataTag) {
            return `Show only ${tagName} projects (${dataTag.count})`;
        }
        return `Show only ${tagName} projects`;
    }
    public tagSelectionForRequire(tagName: string): string[] {
        if (this.isRequired(tagName)) {
            // toggle
            return this.tagSelection.filter(tn => tn !== tagName);
        }
        const existingTagsMinusAnyExclusionOfThisTag = this.tagSelection.filter(tn => tn !== this.pleaseExclude(tagName));
        return [...existingTagsMinusAnyExclusionOfThisTag, tagName];
    }

    public tagSelectionForExclude(tagName: string): string[] {
        if (this.isExcluded(tagName)) {
            // toggle
            return this.tagSelection.filter(tn => tn !== this.pleaseExclude(tagName));
        }
        const existingTagsMinusAnyRequireOfThisTag = this.tagSelection.filter(tn => tn !== tagName);
        return [...existingTagsMinusAnyRequireOfThisTag, this.pleaseExclude(tagName)];

    }

    private pleaseExclude(tagName: string): string {
        return "!" + tagName;
    }

    private dontFeelExcluded(tagName: string): string {
        return tagName.replace("!", "");
    }
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

    const tagGroup = new TagGroup(props.selectedTags, props.tree);

    const tagButtons = displayTagGroup(tagGroup);

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) : "";
    return <div className="sunburst">
        <h1>{props.fingerprintDisplayName}</h1>

        <h2>{props.selectedTags.
            map(t => t.replace("!", "not ")).
            join(" and ") || "All"} - {(props.tree as any).matchingRepoCount} of {(props.tree as any).repoCount} repos</h2>

        <form method="GET" action="/query">
            <input type="hidden" name="explore" value="true" />
            <input type="submit" value="CLEAR" />
        </form>

        {tagButtons}

        {idealDisplay}
        <div className="wrapper">
            <div id="putSvgHere" className="sunburstSvg"></div>
            <div id="dataAboutWhatYouClicked" className="sunburstData">{thingies}</div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }} />
        <a href={"." + props.dataUrl} type="application/json">Raw data</a>
    </div>;

}
