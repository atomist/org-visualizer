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
            <input type="submit" value={possibleIdeal.displayValue} />
        </form>
    </li>;
}

function displaySuggestedIdeals(possibleIdeals: PossibleIdealForDisplay[]): React.ReactElement {
    return <ul>
        {possibleIdeals.map(suggestedIdealListItem)}
        <li key="other">Other: <input /> <button type="submit">Set</button></li>
    </ul>;
}

export function SunburstQuery(props: SunburstQueryProps): React.ReactElement {

    const d3ScriptCall = `<script>sunburst("${props.query || ""}", "${props.dataUrl}", window.innerWidth - 100, window.innerHeight - 100);</script>`;

    const idealDisplay = props.currentIdeal ? displayCurrentIdeal(props.currentIdeal) :
        displaySuggestedIdeals(props.possibleIdeals);
    return <div>
        <h1>{props.fingerprintDisplayName}</h1>
        {idealDisplay}
        <div dangerouslySetInnerHTML={{ __html: d3ScriptCall }} />
    </div>;

}
/*
 See https://bl.ocks.org/vasturiano/12da9071095fbd4df434e60d52d2d58d -->
<!-- Display a sunburst -->

<script>
sunburst('{{ query }}', `{{{dataUrl}}}`, window.innerWidth - 100, window.innerHeight - 100);
</script>
*/
