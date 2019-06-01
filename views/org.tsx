import * as React from "react";

export interface OrgExplorerProps {
    projectsAnalyzed: number;
    actionableFingerprints: ActionableFingerprintForDisplay[];
    importantFeatures: {
        features: FeatureForDisplay[],
    };

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
}
function actionableFingerprintListItem(af: ActionableFingerprintForDisplay): React.ReactElement {
    const queryLink = `./query?name=${af.name}&byOrg=true`;
    const existsLink = `./query?name=${af.name}-present&byOrg=true`;
    return <li key={af.name}><i>{af.featureName}:
                {af.displayName}</i>: {af.appearsIn} projects, {" "}
        <a href={queryLink}>{af.variants} variants</a>
        <a href={existsLink}>Exists?</a>
        {idealDisplay(af)}
    </li>;
}

function idealDisplay(af: MaybeAnIdeal): React.ReactElement {
    let result = <span></span>;
    if (af.ideal) {
        const idealQueryLink = `./query?name=${af.name}-ideal&byOrg=true`;
        result = <span>
            -
            <a href={idealQueryLink}> Progress toward ideal {" "}
                <b>{af.ideal.displayValue}</b>
            </a>
        </span>;
    }
    return result;
}
export interface FeatureForDisplay {
    feature: {
        displayName?: string,
    };
    fingerprints: FingerprintForDisplay[];
}

function displayImportantFeature(f: FeatureForDisplay): React.ReactElement {
    return <div>
        <h3>{f.feature.displayName}</h3>
        <ul>
            {f.fingerprints.map(fingerprintListItem)}
        </ul>

    </div>;
}

export interface FingerprintForDisplay extends MaybeAnIdeal {
    displayName?: string;
    name: string;
    appearsIn: number; // count of projects
    variants: number;
}

function fingerprintListItem(f: FingerprintForDisplay): React.ReactElement {
    const displayName = f.displayName || f.name;
    const variantsQueryLink: string = `./query?name=${f.name}&byOrg=true`;
    return <li>
        <i>{displayName}</i>: {f.appearsIn} projects, {" "}
        <a href={variantsQueryLink}>{f.variants} variants</a>
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
    return <div><a href="./projects">{props.projectsAnalyzed} projects </a>
        <h2>Action Items</h2>
        <div className="actionItemBox">
            <ul>
                {props.actionableFingerprints.map(actionableFingerprintListItem)}
                <li><a href="./query?name=flagged&byOrg=true">Visualize problems</a></li>
            </ul>
        </div>
        <h2>Features</h2>
        <div className="importantFeatures">
            <ul>
                {props.importantFeatures.features.map(displayImportantFeature)}
            </ul>
        </div>
    </div>;
}

export function OrgExplorer(props: OrgExplorerProps): React.ReactElement {
    return <div>
        {displayFeatures(props)}
        <h2>Common queries</h2>
        <h3>Community</h3>
        <ul>
            <li key="community-1"><a href="./query?name=path&path=elements.codeOfConduct.name&byOrg=true&otherLabel=No Code of Conduct :-(">Code of
Conduct</a></li>
        </ul>

        <h3>Code</h3>
        <ul>
            <li key="code-1"><a href="./query?name=langs&byOrg=true">Language breakdown for all projects</a></li>
            <li key="code-2"><a href="./query?name=loc&byOrg=true">Repo sizes</a></li>
            <li key="code-3"><a href="./query?name=dependencyCount&byOrg=true">Number of dependencies</a></li>
            <li key="code-4"><a href="./query?name=licenses&byOrg=true">package.json license</a></li>
        </ul>

        <h3>Docker</h3>
        <ul>
            <li key="docker-1"><a href="./query?name=docker&byOrg=true">Docker Yes/No</a></li>
            <li key="docker-2"><a href="./query?name=path&path=elements.docker.dockerFile.path&unused=No+Docker">Docker file path</a></li>
            <li key="docker-3"><a href="./query?name=dockerPorts&byOrg=true">Exposed Docker ports</a></li>
        </ul>

        <h3>Atomist Status</h3>
        <li><a href="./query?name=uhura&byOrg=true">Uhura delivery status</a></li>

        <h2>Technology identified</h2>
        <form method="GET" action="./query?name=using">
            Technology: <input id="what" name="list" value="node,springboot" />
            <input type="submit" value="Search" />
        </form>

        <h2>Custom path</h2>

        <form method="GET" action="./query?name=path">
            Path: <input id="what" name="path" value="elements.node.typeScript.tslint.hasConfig" ></input>
            <input type="checkbox" name="otherLabel" value="irrelevant"></input>
            Show all
            <input type="submit" value="Search" ></input>
        </form>

        <h2>Data</h2>
        <a href="http://localhost:2866/querydata/typeScriptVersions">Example of backing JSON data</a>
    </div>;
}
