import { RepoRef } from "@atomist/automation-client";
import * as React from "react";

export type ProjectForDisplay = RepoRef; // will likely add more data later

export interface ProjectListProps {
    projects: ProjectForDisplay[];
}

function toListItem(p: ProjectForDisplay): React.ReactNode {
    const linkToIndividualProjectPage = `/project/${p.owner}/${p.repo}`;
    return <li key={p.url}>{p.repo}:{" "}
        <a href={p.url}>
            Source
            </a>{" "}
        <a href={linkToIndividualProjectPage}>
            Explore
        </a>
    </li >;
}

export function ProjectList(props: ProjectListProps): React.ReactNode {
    return <div>
        <h2>{props.projects.length} projects</h2>
        <ul>
            {props.projects.map(toListItem)}
        </ul>
    </div>;
}
