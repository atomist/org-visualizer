import * as _ from "lodash";
import * as React from "react";
import { collapsible } from "./utils";

export interface RepoForDisplay { url: string; repo: string; owner: string; id: string; } // will likely add more data later

export interface RepoListProps {
    repos: RepoForDisplay[];
    virtualProjectCount: number;
}

function toListItem(p: RepoForDisplay): React.ReactElement {
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

function displayOrgProjects(owner: string, repos: RepoForDisplay[]): React.ReactElement {
    return collapsible(owner, `${owner} (${repos.length} projects)`,
        <ul>
            {_.sortBy(repos, p => p.repo.toLowerCase())
                .map(toListItem)}
        </ul>,
        repos.length === 1,
    );
}

export function RepoList(props: RepoListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.repos, p => p.owner);
    return <div>
        <h2>{Object.entries(projectsByOrg).length} organizations containing {" "}
            {props.repos.length} repositories and {" "}
            {props.virtualProjectCount} virtual projects </h2>
        <ul>
            {Object.entries(projectsByOrg).map(kv => displayOrgProjects(...kv))}
        </ul>
    </div>;
}
