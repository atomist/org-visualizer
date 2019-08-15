import * as React from "react";

import * as _ from "lodash";
import { describeSelectedTagsToAnimals, TagTree } from "../lib/routes/api";
import { TagUsage } from "../lib/tree/sunburst";

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

export type FieldToDisplay = string;

export interface SunburstPageProps {
    readonly workspaceId: string;
    readonly heading: string;
    readonly subheading?: string;
    readonly currentIdeal: CurrentIdealForDisplay;
    readonly possibleIdeals: PossibleIdealForDisplay[];
    readonly query: string;
    readonly dataUrl: string;
    readonly tree: TagTree; // we have the data already.

    /**
     * Tags selected
     */
    readonly selectedTags: string[];

    /**
     * If these fields exist on a node, display them on hover
     */
    fieldsToDisplay: FieldToDisplay[];

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
        {tagGroup.tagSelection.length > 0 && <div className="tagGroup">
            clear:
            <form method="GET" action="/explore">
                <input type="hidden" name="explore" value="true" />
                <input className="resetTagSelection" type="submit" value="CLEAR" />
            </form></div>}
        {tagGroup.allTagNames().map(n => displayTagButtons(tagGroup, n))}
    </div>;
}

function displayTagButtons(tagGroup: TagGroup, tagName: string): React.ReactElement {
    const percentageWithTag = tagGroup.getPercentageOfProjects(tagName);
    const percentageBar = <div className="percentageOfProjectWithoutTag">
        <div className="percentageOfProjectsWithTag" style={{ width: percentageWithTag + "%" }}>
            {percentageWithTag}%
        </div>
        {100 - percentageWithTag}%</div>;
    const description = tagGroup.getDescription(tagName) + (tagGroup.isWarning(tagName) ? " - WARN" : "")
        + (tagGroup.isError(tagName) ? " - ERROR" : "");
    return <div className={"tagGroup " +
        (tagGroup.isWarning(tagName) ? "warnTagGroup " : "") +
        (tagGroup.isError(tagName) ? "errorTagGroup " : "") +
        (tagGroup.isRequired(tagName) ? "requiredTag " : "") +
        (tagGroup.isExcluded(tagName) ? "excludedTag" : "")}>
        {percentageBar}
        <img className="taggydoober" src="/taggydoober.png" title={description}></img>
        <span className="tagDescription" title={description}>{tagName}</span>
        <form method="GET" action="/explore">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={tagGroup.tagSelectionForRequire(tagName).join(",")} />
            <input className="requireButton" type="submit" value="Yes please"
                title={tagGroup.describeRequire(tagName)}></input>
        </form>
        <form method="GET" action="/explore">
            <input type="hidden" name="explore" value="true" />
            <input type="hidden" name="tags" value={tagGroup.tagSelectionForExclude(tagName).join(",")} />
            <input className="excludeButton" type="submit" value="Please no" alt="alt text"
                title={tagGroup.describeExclude(tagName)} />
        </form>
    </div>;
}

/**
 * Class backing displayTagButtons
 */
export class TagGroup {

    private readonly tagsInData: TagUsage[];

    private readonly totalProjectsDisplayed: number;

    constructor(public readonly tagSelection: string[],
                treeWithTags?: { tags?: TagUsage[], matchingRepoCount?: number }) {
        this.tagsInData = treeWithTags && treeWithTags.tags ? treeWithTags.tags : [];
        this.totalProjectsDisplayed = treeWithTags ? treeWithTags.matchingRepoCount : 0;
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

    public isWarning(tagName: string): boolean {
        const tagUsage = this.tagsInData.find(tu => tu.name === tagName);
        return tagUsage && tagUsage.severity === "warn";
    }

    public isError(tagName: string): boolean {
        const tagUsage = this.tagsInData.find(tu => tu.name === tagName);
        return tagUsage && tagUsage.severity === "error";
    }

    public getDescription(tagName: string): string | undefined {
        const tagUsage = this.tagsInData.find(tu => tu.name === tagName);
        return tagUsage ? tagUsage.description : "";
    }

    public getPercentageOfProjects(tagName: string): number {
        if (this.isExcluded(tagName)) {
            return 0;
        }
        if (this.isRequired(tagName)) {
            return 100;
        }
        const data = this.tagsInData.find(t => t.name === tagName);
        if (!data) {
            return 0; // whatever
        }
        return Math.round(data.count * 100 / this.totalProjectsDisplayed);
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
    const perLevelDataItems = !props.tree || !props.tree.circles ?
        [] :
        props.tree.circles.map((c, i) => ({ textAreaId: "levelData-" + i, labelText: c.meaning }));

    const d3ScriptCall = `<script>
    const data = ${JSON.stringify(props.tree)};
    SunburstYo.sunburst("${props.workspaceId}",
        data,
        window.innerWidth - 250,
        window.innerHeight - 100,
        { perLevelDataElementIds: [${perLevelDataItems.map(p => `"` + p.textAreaId + `"`).join(",")}],
          fieldsToDisplay: ${JSON.stringify(props.fieldsToDisplay)}
    });
    </script>`;

    const thingies: string | React.ReactElement = !props.tree ? "Hover over a slice to see its details" :
        <ul>{perLevelDataItems.map(levelDataListItem)}</ul>;

    const tagGroup = new TagGroup(props.selectedTags, props.tree);

    const tagButtons = displayTagGroup(tagGroup);

    const h2 = props.subheading ?
        <h2>{props.subheading}</h2> :
        <h2>{describeSelectedTagsToAnimals(props.selectedTags)} - {props.tree.matchingRepoCount} of {props.tree.repoCount} repositories</h2>;

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) : "";
    return <div className="sunburst">
        <h1>{props.heading}</h1>

        {h2}

        {tagButtons}

        {idealDisplay}
        <div className="wrapper">
            <div id="putSvgHere" className="sunburstSvg"></div>
            <div id="dataAboutWhatYouClicked" className="sunburstData">{thingies}
                <div id="additionalDataAboutWhatYouClicked"></div>
            </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }} />
        <a href={props.dataUrl} type="application/json">Raw data</a>
    </div>;

}
