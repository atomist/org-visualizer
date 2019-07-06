import * as React from "react";
import { ProjectForDisplay, ProjectList } from "./projectList";

export interface FingerprintForDisplay extends MaybeAnIdeal {
    type: string;
    displayName?: string;
    name: string;
    featureName: string;
    appearsIn: number; // count of projects
    variants: number;
}

export interface FeatureForDisplay {
    feature: {
        name: string,
        displayName?: string,
    };
    fingerprints: FingerprintForDisplay[];
}
export interface OrgExplorerProps {
    projectsAnalyzed: number;
    actionableFingerprints: ActionableFingerprintForDisplay[];
    importantFeatures: {
        features: FeatureForDisplay[],
    };
    projects: ProjectForDisplay[];
}

export interface MaybeAnIdeal {
    /* name of the finger print */
    name: string;
    ideal?: {
        displayValue: string;
    };
}
export interface ActionableFingerprintForDisplay extends FingerprintForDisplay {
    featureName: string;
    type: string;
}
function actionableFingerprintListItem(af: ActionableFingerprintForDisplay): React.ReactElement {
    const queryLink = `./query?type=${af.type}&name=${af.name}&byOrg=true`;
    const existsLink = `./query?type=${af.type}&name=${af.name}-present&filter=true&byOrg=true`;
    return <li key={af.name}><i>{af.featureName}:
                {af.displayName}</i>: {af.appearsIn} projects, {" "}
        <a href={queryLink}>{af.variants} variants</a> -
         <a href={existsLink}> Exists?</a>
        {idealDisplay(af)}
    </li>;
}

function idealDisplay(af: MaybeAnIdeal): React.ReactElement {
    let result = <span></span>;
    if (af.ideal) {
        const idealQueryLink = `./query?name=${af.name}-ideal&filter=true&byOrg=true`;
        result = <span>
            -
            <a href={idealQueryLink}> Progress toward ideal {" "}
                <b>{af.ideal.displayValue}</b>
            </a>
        </span>;
    }
    return result;
}

function displayImportantFeature(f: FeatureForDisplay, i: number): React.ReactElement {
    const key = "collapsible" + i;
    const expandByDefault = f.fingerprints.length === 1;

    const allLink: string = `./query?type=${f.feature.name}&name=*&byOrg=true`;

    return <div className="wrap-collabsible feature-collapsible">
        <input id={key} className="sneaky toggle" type="checkbox" defaultChecked={expandByDefault}></input>
        <label htmlFor={key} className="lbl-toggle fp-list">{f.feature.displayName} ({f.fingerprints.length})</label>
        <div className="collapsible-content">
            <div className="content-inner">
                <ul>
                    {f.fingerprints.map(fingerprintListItem)}
                    <li><a href={allLink}>All of type</a></li>
                </ul>
            </div></div></div>;
}

function fingerprintListItem(f: FingerprintForDisplay): React.ReactElement {
    const displayName = f.displayName || f.name;
    const variantsQueryLink: string = `./query?type=${f.type}&name=${f.name}&byOrg=true`;
    const existsLink: string = `./query?filter=true&type=${f.type}&name=${f.name}-present&byOrg=true`;

    return <li key={displayName}>
        <i>{displayName}</i>: {f.appearsIn} projects, {" "}
        <a href={variantsQueryLink}>{f.variants} variants</a> {" "}
        <a href={existsLink}>Presence</a>
        {idealDisplay(f)}
    </li>;
}

export function displayFeatures(props: OrgExplorerProps): React.ReactElement {
    if (props.projectsAnalyzed === 0) {
        return <div><h2>No projects analyzed</h2>
            To investigate some projects, run `npm link` and then `spider --owner atomist`<br></br>
            Substitute your GitHub user or organization for `atomist` to get results for your own projects!
        </div>;
    }

    const actionItems = <div><h2>Action Items</h2>
        <div className="actionItemBox">
            <ul>
                {props.actionableFingerprints.map(actionableFingerprintListItem)}
                <li key="vp"><a href="./query?filter=true&name=flagged&byOrg=true">Visualize problems</a></li>
            </ul>
        </div></div>;

    const projectSummary = <ProjectList projects={props.projects}></ProjectList>;
    return <div>

        {projectSummary}

        {/*actionItems*/}
        <h2>Features</h2>
        <div className="importantFeatures">
            <ul>
                {props.importantFeatures.features.map(displayImportantFeature)}
            </ul>
        </div>
    </div>;
}

// tslint:disable:max-line-length

export function OrgExplorer(props: OrgExplorerProps): React.ReactElement {
    return <div>
        {displayFeatures(props)}
        <h2>Common queries</h2>
        <h3>Community</h3>
        <ul>
            <li key="community-1"><a href="./query?filter=true&name=path&path=elements.codeOfConduct.name&byOrg=true&otherLabel=No Code of Conduct :-(">Code of
Conduct</a></li>
        </ul>

        <h3>Code</h3>
        <ul>
            <li key="code-1"><a href="./query?skew=true&byOrg=true">Feature drift</a></li>

            <li key="code-2"><a href="./query?filter=true&name=featureCount&byOrg=true">Feature count by project</a></li>

            <li key="code-3"><a href="./query?filter=true&name=fileCount&byOrg=true">Repo filecount</a></li>
            <li key="code-4"><a href="./query?filter=true&name=branchCount&byOrg=true">Branch count</a></li>

            <li key="code-4a"><a href="./query?filter=true&name=recency&byOrg=true">Commit recency</a></li>

            <li key="code-5"><a href="./query?filter=true&name=langs&byOrg=true">Language breakdown for all projects</a></li>
            <li key="code-6"><a href="./query?filter=true&name=loc&byOrg=true">Repo sizes</a></li>
            <li key="code-7"><a href="./query?filter=true&name=mavenDependencyCount&byOrg=true">Number of Maven dependencies</a></li>
            <li key="code-8"><a href="./query?filter=true&name=npmDependencyCount&byOrg=true">Number of npm dependencies</a></li>

            <li key="code-9"><a href="./query?filter=true&name=licenses&byOrg=true">package.json license</a></li>
        </ul>

        <h2>Custom fingerprint</h2>

        <form method="GET" action="./query">
            Feature name: <input id="type" name="type" value="spring-boot-version" readOnly={true}></input>

            Fingerprint name: <input id="name" name="name" value="spring-boot-version" readOnly={true}></input>
            <input type="checkbox" name="otherLabel" value="irrelevant" readOnly={true}></input>
            Show all
            <input type="submit" defaultValue="Visualize"></input>
        </form>

        <h2>Data</h2>
        <a href="./api/v1/*/fingerprint/npm-project-deps/tslint?type=npm-project-deps&name=tslint&byOrg=true">Example of backing JSON data</a>
    </div>;
}
