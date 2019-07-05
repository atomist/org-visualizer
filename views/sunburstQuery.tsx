import * as React from "react";

// tslint:disable-next-line:no-empty-interface
export interface CurrentIdealForDisplay { }

export interface PossibleIdealForDisplay {
    url?: string;
    fingerprintName: string;
    displayValue: string;
    stringified: string;
}

export interface SunburstQueryProps {
    fingerprintDisplayName: string;
    currentIdeal: CurrentIdealForDisplay;
    possibleIdeals: PossibleIdealForDisplay[];
    query: string;
    dataUrl: string;
}

function displayCurrentIdeal(currentIdeal: CurrentIdealForDisplay): React.ReactElement {
    return <h2>
        Current ideal: {currentIdeal}
    </h2>;
}

function suggestedIdealListItem(possibleIdeal: PossibleIdealForDisplay): React.ReactElement {
    return <li key={possibleIdeal.url}>
        The <a href={possibleIdeal.url}>world</a> suggests:
        <form action="/setIdeal" method="post">
            <input hidden={true} type="text" readOnly={true} id="stringifiedFP" name="stringifiedFP"
                value={possibleIdeal.stringified} />
            <input hidden={true} readOnly={true} type="text" id="fingerprintName" name="fingerprintName" value={possibleIdeal.fingerprintName} />
            <input type="submit" defaultValue={possibleIdeal.displayValue} />
        </form>
    </li>;
}

function displaySuggestedIdeals(possibleIdeals: PossibleIdealForDisplay[]): React.ReactElement {
    return <ul>
        {possibleIdeals.map(suggestedIdealListItem)}
        <li key="other">Other: <input defaultValue="" /> <button type="submit">Set</button></li>
    </ul>;
}

export function SunburstQuery(props: SunburstQueryProps): React.ReactElement {

    const d3ScriptCall = `<script>sunburst("${props.query || ""}", "${props.dataUrl}", window.innerWidth - 250, window.innerHeight - 100);</script>`;

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) :
        displaySuggestedIdeals(props.possibleIdeals);
    return <div className="sunburst">
        <h1>{props.fingerprintDisplayName}</h1>
        {/*{idealDisplay}*/}
        <div className="wrapper">
            <div id="putSvgHere" className="sunburstSvg"></div>
            <div id="dataAboutWhatYouClicked" className="sunburstData">Click a slice to see its details</div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }} />
        <a href={"." + props.dataUrl}>Raw data</a>
    </div>;

}
