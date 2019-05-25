import * as React from "react";

export function TopLevelPage(props: {
    bodyContent: React.ReactElement,
    pageTitle?: string,
}): React.ReactElement {
    return <html>
        <head>
            <title>
                {props.pageTitle || "Atomist Explorer"}
            </title>
            <link rel="stylesheet" type="text/css" href="/styles.css"></link>
        </head>
        <body>
            <h1>Atomist Explorer</h1>
            {props.bodyContent}
        </body>
    </html>;
}
