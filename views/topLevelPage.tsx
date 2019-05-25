import * as React from "react";

export function TopLevelPage(props: {
    bodyContent: React.ReactNode,
    pageTitle?: string,
}): React.ReactNode {
    return <html>
        <head>
            <title>
                {props.pageTitle || "Atomist Explorer"}
            </title>
            <link rel="stylesheet" type="text/css" href="/styles.css"></link>
        </head>
        <body>
            {props.bodyContent}
        </body>
    </html>;
}
