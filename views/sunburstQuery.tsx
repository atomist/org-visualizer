import * as React from "react";

export interface SunburstQueryProps {
    fingerprintDisplayName: string;
}

export function SunburstQuery(props: SunburstQueryProps): React.ReactElement {
    return <div>
        <h1>{props.fingerprintDisplayName}</h1>
    </div>;
}
/*
<!-- See https://bl.ocks.org/vasturiano/12da9071095fbd4df434e60d52d2d58d -->
<!-- Display a sunburst -->
<h1>
  {{fingerprintDisplayName}}
</h1>
{{#if currentIdeal}}
<h2>
  Current ideal:
  {{currentIdeal}}
</h2>
{{else}}
<h2>
  Set an ideal?
</h2>
{{#if possibleIdeals.world}}
<li>
  The <a href="{{possibleIdeals.world.url}}">world</a> suggests:
  <form action="/setIdeal" method="post">
    <input hidden=true type="text" id="stringifiedFP" name="stringifiedFP"
      value="{{possibleIdeals.world.stringified}}" />
    <input hidden=true type="text" id="fingerprintName" name="fingerprintName" value="{{fingerprintName}}" />
    <input type="submit" value="{{possibleIdeals.world.displayValue}}">
  </form>
</li>
{{/if}}
{{#if possibleIdeals.fromProjects}}
<li>
  Based on existing projects, you might want:
  <button>{{possibleIdeals.fromProjects.ideal.data}}</button>
</li>
{{/if}}
<li>Other: <input /><button type="submit">Set</button></li>
{{/if}}
<script>
  sunburst('{{query}}', `{{{dataUrl}}}`, window.innerWidth - 100, window.innerHeight - 100);
</script>
*/
