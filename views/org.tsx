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

export interface ManagedFeatureForDisplay {
    name: string;
    displayName?: string;
    documentationUrl?: string;
}

export interface FeatureForDisplay {
    feature: ManagedFeatureForDisplay;
    fingerprints: FingerprintForDisplay[];
}
export interface OrgExplorerProps {
    projectsAnalyzed: number;
    actionableFingerprints: ActionableFingerprintForDisplay[];
    importantFeatures: FeatureForDisplay[];
    unfoundFeatures: ManagedFeatureForDisplay[];
    projects: ProjectForDisplay[];
}

export interface MaybeAnIdeal {
    type: string;
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
        const idealQueryLink: string = `./query?filter=true&type=${af.type}&name=${af.name}-progress&byOrg=true`;

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

    const about = !f.feature.documentationUrl ? "" :
        <a href={f.feature.documentationUrl}>About</a>;

    const graphAll = f.fingerprints.length <= 1 ? "" : <a href={allLink}>All fingerprints</a>;

    const summaryListItem = about || graphAll ? <li key={"all" + i}>{about} {graphAll}</li> : "";

    return <div className="wrap-collapsible feature-collapsible">
        <input id={key} className="sneaky toggle" type="checkbox" defaultChecked={expandByDefault}></input>
        <label htmlFor={key} className="lbl-toggle fp-list">{f.feature.displayName} ({f.fingerprints.length})</label>
        <div className="collapsible-content">
            <div className="content-inner">
                <ul>
                    {summaryListItem}
                    {f.fingerprints.map(fingerprintListItem)}
                </ul>
            </div></div></div>;
}

function displayUnfoundFeatures(mfs: ManagedFeatureForDisplay[]): React.ReactElement {
    if (mfs.length === 0) {
        return <div></div>;
    }
    return <div>
        <h2>Unseen Features</h2>
        These features were not found in any project:
        <ul>
            {mfs.map(displayUnfoundFeature)}
        </ul>
    </div>;
}

function displayUnfoundFeature(mf: ManagedFeatureForDisplay, i: number): React.ReactElement {
    const link = !!mf.documentationUrl ?
        <a href={mf.documentationUrl}>{mf.displayName}</a> : mf.displayName;
    return <li className="unfound">
        {link}
    </li>;
}

function fingerprintListItem(f: FingerprintForDisplay): React.ReactElement {
    const displayName = f.displayName || f.name;
    const variantsQueryLink: string = `./query?type=${f.type}&name=${f.name}&byOrg=true`;
    const existsLink: string = `./query?filter=true&type=${f.type}&name=${f.name}-present&byOrg=true`;

    return <li key={displayName}>
        <i>{displayName}</i>: {f.appearsIn} projects, {" "}
        <a href={variantsQueryLink}>{f.variants} variants</a> {" "}
        <a href={existsLink}>Presence</a> {" "}
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
                {props.importantFeatures.map(displayImportantFeature)}
            </ul>
        </div>
        {displayUnfoundFeatures(props.unfoundFeatures)}
    </div>;
}

// tslint:disable:max-line-length

export function OrgExplorer(props: OrgExplorerProps): React.ReactElement {
    return <div>
        {displayFeatures(props)}

        <h2>Common queries</h2>

        <h3>See Problems</h3>
        <ul>
            <li key="vp"><a href="./query?filter=true&name=flagged&byOrg=true">Visualize problems</a></li>

        </ul>

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
