import * as _ from "lodash";
import * as React from "react";
import { SortOrder } from "../lib/routes/web-app/repositoryListPage";
import { collapsible } from "./utils";

export interface RepoForDisplay {
    url: string;
    repo: string;
    owner: string;
    id: string;
    score?: number;

    /**
     * Whether to show the full path of the repo
     */
    showFullPath?: boolean;
}

export interface RepoListProps {
    repos: RepoForDisplay[];
    virtualProjectCount: number;
    sortOrder: SortOrder;
    byOrg: boolean;
    expand: boolean;
}

function toRepoListItem(rfd: RepoForDisplay): React.ReactElement {
    const linkToIndividualProjectPage = `/repository?id=${encodeURI(rfd.id)}`;
    return <li key={rfd.url}>{rfd.showFullPath && `${rfd.owner} / `}{rfd.repo} {rfd.score && `(${rfd.score.toFixed(2)})`}:{" "}
        <a href={rfd.url}>
            Source
        </a>{" "}
        <a href={linkToIndividualProjectPage}>
            Insights
        </a>
    </li>;
}

function displayProjects(owner: string,
                         repos: RepoForDisplay[],
                         props: RepoListProps): React.ReactElement {
    const sorted = _.sortBy(repos,
        p => props.sortOrder === "score" ?
            p.score :
            p.repo.toLowerCase());
    return collapsible(owner, `${owner} (${repos.length} repositories)`,
        <ul>
            {sorted.map(toRepoListItem)}
        </ul>,
        repos.length === 1 || props.expand,
    );
}

export function RepoList(props: RepoListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.repos, p => p.owner);
    return <div>
        <h2>{Object.entries(projectsByOrg).length} organizations containing {" "}
            {props.repos.length} repositories and {" "}
            {props.virtualProjectCount} virtual projects </h2>

        {props.byOrg ? reposByOrg(props) : reposRanked(props)}
    </div>;
}

function reposByOrg(props: RepoListProps): React.ReactElement {
    const projectsByOrg = _.groupBy(props.repos, p => p.owner);
    return <ul>
        {Object.entries(projectsByOrg).map(kv => displayProjects(kv[0], kv[1], props))}
    </ul>;
}

function reposRanked(props: RepoListProps): React.ReactElement {
    return <ul>
        {displayProjects("Ranked", props.repos, props)}
    </ul>;
}
