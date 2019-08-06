import * as React from "react";
import * as ReactDOMServer from "react-dom/server";

export function renderStaticReactNode(body: React.ReactElement,
                                      title?: string,
                                      extraScripts?: string[]): string {
    return ReactDOMServer.renderToStaticMarkup(
        TopLevelPage({
            bodyContent: body,
            pageTitle: title,
            extraScripts,
        }));
}

function extraScript(src: string): React.ReactElement {
    return <script src={src}></script>;
}

export function TopLevelPage(props: {
    bodyContent: React.ReactElement,
    pageTitle?: string,
    extraScripts?: string[],
}): React.ReactElement {
    return <html>
    <head>
        <title>
            {props.pageTitle || "Atomist Explorer"}
        </title>
        <link rel="stylesheet" type="text/css" href="/styles.css"></link>
    </head>
    {(props.extraScripts || []).map(extraScript)}
    <body>
    <header>
        <div className="around-page-title">
            <a href="/org"><img className="atomist-logo" src="/atomist-logo-small-white.png"/></a>
            <span className="page-title">
                        {props.pageTitle || "Atomist Explorer"}
                    </span>
        </div>
    </header>
    <main>
        {props.bodyContent}
    </main>
    </body>
    </html>;
}
