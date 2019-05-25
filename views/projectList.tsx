import { RepoRef } from "@atomist/automation-client";
import * as React from "react";

export type ProjectForDisplay = RepoRef; // will likely add more data later

export interface ProjectListProps {
    projects: ProjectForDisplay[];
}

function toListItem(p: ProjectForDisplay): React.ReactNode {
    return <li>{p.repo}</li>;
}

export function ProjectList(props: ProjectListProps): React.ReactNode {
    return <div>
        <h2>{props.projects.length} projects</h2>
        <ul>
            {props.projects.map(toListItem)}
        </ul>
    </div>;
}

/*
<h1>Atomist Explorer</h1>

{{ repos.length }} projects

<br>

{{#each repos }}

<li>
    <b><a href="/project/{{this.analysis.id.owner}}/{{this.analysis.id.repo}}">
            {{this.analysis.id.repo}}</a></b>: <a href="{{this.analysis.id.url}}">{{this.analysis.id.url}}</a>
</li>

{{/each}}
*/
