import * as React from "react";

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
    fingerprintDisplayName: string;
    currentIdeal: CurrentIdealForDisplay;
    possibleIdeals: PossibleIdealForDisplay[];
    query: string;
    dataUrl: string;
}

function displayCurrentIdeal(currentIdeal: CurrentIdealForDisplay): React.ReactElement {
    return <h2>
        Current ideal: {currentIdeal.displayValue}
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

export function SunburstPage(props: SunburstPageProps): React.ReactElement {

    const d3ScriptCall = `<script>
    SunburstYo.sunburst("${props.query || ""}",
        "${props.dataUrl}",
        window.innerWidth - 250,
        window.innerHeight - 100);
    </script>`;

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) : "";
    return <div className="sunburst">
        <h1>{props.fingerprintDisplayName}</h1>
        {idealDisplay}
        <div className="wrapper">
            <div id="putSvgHere" className="sunburstSvg"></div>
            <div id="dataAboutWhatYouClicked" className="sunburstData">Click a slice to see its details</div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }} />
        <a href={"." + props.dataUrl}>Raw data</a>
    </div>;

}
