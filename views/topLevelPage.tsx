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
            <header><h1>Atomist Explorer</h1></header>
            <main>
                {props.bodyContent}
            </main>
        </body>
    </html>;
}
