import * as React from "react";

export function collapsible(key: string, title: string, content: React.ReactElement, startOpen: boolean): React.ReactElement {
    return <div className="wrap-collapsible owner-collapsible">
    <input id={key} className="sneaky toggle" type="checkbox" defaultChecked={startOpen}></input>
        <label htmlFor={key} className="lbl-toggle">{title}</label>
        <div className="collapsible-content">
    <div className="content-inner">
        {content}
        </div></div></div>;
}
