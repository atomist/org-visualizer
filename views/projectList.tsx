import * as _ from "lodash";
import * as React from "react";
import { collapsible } from "./utils";

export interface ProjectForDisplay { url: string; repo: string; owner: string; id: string; } // will likely add more data later

export interface ProjectListProps {
    projects: ProjectForDisplay[];
}

function toListItem(p: ProjectForDisplay): React.ReactElement {
    const linkToIndividualProjectPage = `/project?id=${encodeURI(p.id)}`;
    return <li key={p.url}>{p.repo}:{" "}
        <a href={p.url}>
            Source
            </a>{" "}
        <a href={linkToIndividualProjectPage}>
            Insights
        </a>
    </li >;
}

function displayOrgProjects(owner: string, projects: ProjectForDisplay[]): React.ReactElement {
    return collapsible(owner, `${owner} (${projects.length} projects)`,
        <ul>
            {_.sortBy(projects, p => p.repo.toLowerCase())
                .map(toListItem)}
        </ul>,
        projects.length === 1,
    );
}

export function ProjectList(props: ProjectListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.projects, p => p.owner);
    return <div>
        <h2>Organizations and Projects ({props.projects.length})</h2>
        <ul>
            {Object.entries(projectsByOrg).map(kv => displayOrgProjects(...kv))}
        </ul>
    </div>;
}
