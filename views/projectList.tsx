import { RepoRef } from "@atomist/automation-client";
import * as _ from "lodash";
import * as React from "react";

export type ProjectForDisplay = RepoRef; // will likely add more data later

export interface ProjectListProps {
    projects: ProjectForDisplay[];
}

function toListItem(p: ProjectForDisplay): React.ReactElement {
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

function displayOrgProjects(owner: string, projects: ProjectForDisplay[]): React.ReactElement {
    return <div>
        <h3>{owner}</h3>
        <ul>
            {projects.map(toListItem)}
        </ul>
    </div>;
}

export function ProjectList(props: ProjectListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.projects, p => p.owner);
    return <div>
        <h2>{props.projects.length} projects</h2>
        {Object.entries(projectsByOrg).map(kv => displayOrgProjects(...kv))}
    </div>;
}
