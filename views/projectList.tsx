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
    return collapsible(owner, `${owner} (${projects.length} projects)`,
        <ul>
            {projects.map(toListItem)}
        </ul>,
        projects.length === 1,
    );
}

export function ProjectList(props: ProjectListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.projects, p => p.owner);
    return <div>
        <h2>{props.projects.length} projects</h2>
        <ul>
            {Object.entries(projectsByOrg).map(kv => displayOrgProjects(...kv))}
        </ul>
    </div>;
}

function collapsible(key: string, title: string, content: React.ReactElement, startOpen: boolean): React.ReactElement {
    return <div className="wrap-collabsible project-list">
        <input id={key} className="sneaky toggle" type="checkbox" defaultChecked={startOpen}></input>
        <label htmlFor={key} className="lbl-toggle project-list">{title}</label>
        <div className="collapsible-content project-list">
            <div className="content-inner project-list">
                {content}
            </div></div></div>;
}
