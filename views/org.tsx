import { BaseAspect } from "@atomist/sdm-pack-fingerprints";
import * as React from "react";
import { FingerprintUsage } from "../lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { CohortAnalysis } from "../lib/analysis/offline/spider/analytics";
import { ProjectForDisplay, ProjectList } from "./projectList";

export interface FingerprintForDisplay extends Pick<FingerprintUsage, "type" | "name">, Pick<CohortAnalysis, "count" | "variants">, MaybeAnIdeal {
    displayName: string;
    entropy?: number;
}

type AspectForDisplay = Pick<BaseAspect, "documentationUrl" | "name" | "displayName">;

export interface AspectFingerprintsForDisplay {
    aspect: AspectForDisplay;
    fingerprints: FingerprintForDisplay[];
}

interface UnfoundAspectForDisplay {
    documentationUrl?: string;
    displayName: string;
}
export interface OrgExplorerProps {
    projectsAnalyzed: number;
    importantAspects: AspectFingerprintsForDisplay[];
    unfoundAspects: UnfoundAspectForDisplay[];
    projects: ProjectForDisplay[];
}

export interface MaybeAnIdeal {
    type: string;
    name: string;
    ideal?: {
        displayValue: string;
    };
}

function idealDisplay(af: MaybeAnIdeal): React.ReactElement {
    let result = <span></span>;
    if (af.ideal) {
        const idealQueryLink: string = `./query?type=${af.type}&name=${af.name}&byOrg=true&progress=true`;

        result = <span>
            -
            <a href={idealQueryLink}> Progress toward ideal {" "}
                <b>{af.ideal.displayValue}</b>
            </a>
        </span>;
    }
    return result;
}

function displayImportantAspect(f: AspectFingerprintsForDisplay, i: number): React.ReactElement {
    const key = "collapsible" + i;
    const expandByDefault = f.fingerprints.length === 1;

    const allLink: (trim: boolean) => string = trim => `./query?type=${f.aspect.name}&name=*&byOrg=true&trim=${trim}`;
    const about = !f.aspect.documentationUrl ? "" :
        <a href={f.aspect.documentationUrl}>About</a>;

    const graphAll = f.fingerprints.length <= 1 ? "" : <a href={allLink(true)}>All fingerprints</a>;
    const graphAllExpanded = f.fingerprints.length <= 1 ? "" : <a href={allLink(false)}>Expanded</a>;

    const summaryListItem = about || graphAll || graphAllExpanded ? <li key={"all" + i}>{about} {graphAll} {graphAllExpanded}</li> : "";

    return <div className="wrap-collapsible feature-collapsible">
        <input id={key} className="sneaky toggle" type="checkbox" defaultChecked={expandByDefault}></input>
        <label htmlFor={key} className="lbl-toggle fp-list">{f.aspect.displayName} ({f.fingerprints.length})</label>
        <div className="collapsible-content">
            <div className="content-inner">
                <ul>
                    {summaryListItem}
                    {f.fingerprints.map(fingerprintListItem)}
                </ul>
            </div></div></div>;
}

function displayUnfoundAspects(mfs: Array<{}>): React.ReactElement {
    if (mfs.length === 0) {
        return <div></div>;
    }
    return <div>
        <h2>Unseen Aspects</h2>
        These aspects were not found in any project:
        <ul>
            {mfs.map(displayUnfoundAspect)}
        </ul>
    </div>;
}

function displayUnfoundAspect(mf: { documentationUrl?: string, displayName: string }, i: number): React.ReactElement {
    const link = !!mf.documentationUrl ?
        <a href={mf.documentationUrl}>{mf.displayName}</a> : mf.displayName;
    return <li className="unfound">
        {link}
    </li>;
}

function fingerprintListItem(f: FingerprintForDisplay): React.ReactElement {
    const displayName = f.displayName || f.name;
    const variantsQueryLink: string = `./query?type=${f.type}&name=${f.name}&byOrg=true`;
    const existsLink: string = `./query?type=${f.type}&name=${f.name}&byOrg=true&presence=true&otherLabel=true`;
    const ent = f.entropy ? <span>{`entropy=${f.entropy.toFixed(2)}`}</span> : "";

    return <li key={displayName}>
        <i>{displayName}</i>: {f.count} projects, {" "}
        <a href={variantsQueryLink}>{f.variants} variants</a>{" "}{ent}{" "}
        <a href={existsLink}>Presence</a> {" "}
        {idealDisplay(f)}
    </li>;
}

export function displayAspects(props: OrgExplorerProps): React.ReactElement {
    if (props.projectsAnalyzed === 0) {
        return <div><h2>No projects analyzed</h2>
            Use the <pre>spider</pre> command to investigate some projects.
            See <a href="https://github.com/atomist-blogs/org-visualizer/blob/master/README.md#analyze-your-repositories">the README</a> for details.
        </div>;
    }

    const projectSummary = <ProjectList projects={props.projects}></ProjectList>;
    const repos = "./query?explore=true";

    return <div>

        {projectSummary}

        <h2>Explore</h2>
        <a href={repos}>Interactive explorer</a>

        <h2>Aspects</h2>
        <div className="importantFeatures">
            <ul>
                {props.importantAspects.map(displayImportantAspect)}
            </ul>
        </div>
        {displayUnfoundAspects(props.unfoundAspects)}
    </div>;
}

// tslint:disable:max-line-length

export function OrgExplorer(props: OrgExplorerProps): React.ReactElement {
    return <div>
        {displayAspects(props)}

        <h2>Common queries</h2>

        <h3>Code</h3>
        <ul>
            <li key="code-1"><a href="./query?skew=true&byOrg=true">Entropy explorer</a></li>

            <li key="code-2"><a href="./query?filter=true&name=aspectCount&byOrg=true">Aspect count by project</a></li>

            <li key="code-5"><a href="./query?filter=true&name=langs&byOrg=true">Language breakdown for all projects</a></li>
            <li key="code-6"><a href="./query?filter=true&name=loc&byOrg=true">Repo sizes</a></li>
        </ul>

        <h2>Data</h2>
        <ul>
            <li><a href="./api-docs">Swagger documentation</a></li>
            <li><a href="./api/v1/*/fingerprint/npm-project-deps/tslint?type=npm-project-deps&name=tslint&byOrg=true">Example of backing JSON data</a></li>
        </ul>
    </div>;
}
