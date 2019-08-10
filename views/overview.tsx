import { BaseAspect } from "@atomist/sdm-pack-fingerprints";
import * as React from "react";
import { FingerprintUsage } from "../lib/analysis/offline/persist/ProjectAnalysisResultStore";
import { CohortAnalysis } from "../lib/analysis/offline/spider/analytics";
import { CustomReporters } from "../lib/customize/customReporters";
import { RepoForDisplay, RepoList } from "./repoList";
import { collapsible } from "./utils";

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
    repos: RepoForDisplay[];
    virtualProjectCount: number;
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
        const idealQueryLink: string = `./fingerprint/${af.type}/${af.name}?byOrg=true&progress=true`;

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

    const allLink: (trim: boolean) => string = trim => `./fingerprint/${f.aspect.name}/*?byOrg=true&trim=${trim}`;
    const about = !f.aspect.documentationUrl ? "" :
        <a href={f.aspect.documentationUrl}>About</a>;

    const graphAll = f.fingerprints.length <= 1 ? "" : <a href={allLink(true)}>All fingerprints</a>;
    const graphAllExpanded = f.fingerprints.length <= 1 ? "" : <a href={allLink(false)}>Expanded</a>;

    const summaryListItem = about || graphAll || graphAllExpanded ?
        <li key={"all" + i}>{about} {graphAll} {graphAllExpanded}</li> : "";

    return <div className="wrap-collapsible feature-collapsible">
        <input id={key} className="sneaky toggle" type="checkbox" defaultChecked={expandByDefault}></input>
        <label htmlFor={key} className="lbl-toggle fp-list">{f.aspect.displayName} ({f.fingerprints.length})</label>
        <div className="collapsible-content">
            <div className="content-inner">
                <ul>
                    {summaryListItem}
                    {f.fingerprints.map(fingerprintListItem)}
                </ul>
            </div>
        </div>
    </div>;
}

function displayUnfoundAspects(mfs: Array<{}>): React.ReactElement {
    if (mfs.length === 0) {
        return <div></div>;
    }
    return <div>
        <h2>Unseen Aspects</h2>
        These aspects are understood by this <i>org-visualizer</i> instance but were not found in any project:
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
    const variantsQueryLink: string = `./fingerprint/${f.type}/${f.name}?byOrg=true`;
    const existsLink: string = `./fingerprint/${f.type}/${f.name}?byOrg=true&presence=true&otherLabel=true`;
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
        return <div>
            <h2>No projects analyzed</h2>
            Use the spider command to investigate some projects.
            See <a
            href="https://github.com/atomist-blogs/org-visualizer/blob/master/README.md#analyze-your-repositories">the
            README</a> for details.
        </div>;
    }

    const projectSummary =
        <RepoList repos={props.repos}
                  virtualProjectCount={props.virtualProjectCount}
                  sortOrder="name"
                  byOrg={true}
                  expand={false}/>;

    return <div>

        {displayDashboards()}

        {/*{projectSummary}*/}

        <h2>Aspects</h2>
        <div className="importantFeatures">
            <ul>
                {props.importantAspects.map(displayImportantAspect)}
            </ul>
        </div>
        {displayUnfoundAspects(props.unfoundAspects)}
    </div>;
}

function displayDashboards(): React.ReactElement {
    return <div>
        <h2>Dashboards</h2>
        <ul>
            {collapsible("explore", "Explore",
                <ul>
                    <li><a href="./explore">Interactive explorer</a> - Explore your repository by tags</li>
                    <li key="code-1"><a href="./drift?byOrg=true">Drift by aspect</a> - See which aspects have the
                        greatest entropy
                    </li>
                </ul>,
                true)}
            {collapsible("repo-nav", "Repository List",
                <ul>
                    <li><a href="./repositories?byOrg=true">By organization</a></li>
                    <li><a href="./repositories?byOrg=false">Ranked</a></li>
                </ul>,
                true)}
            {collapsible("custom-reports", "Custom Reports",
                displayCustomReports(),
                true)}
        </ul>
    </div>;
}

function displayCustomReports(): React.ReactElement {
    return <ul>
        {Object.getOwnPropertyNames(CustomReporters).map(name => {
            const reporter = CustomReporters[name];
            return <li key={`report-${name}`}><a
                href={`./report/${name}?byOrg=true`}>{reporter.summary}</a> - {reporter.description}</li>;
        })}
    </ul>;
}

// tslint:disable:max-line-length

export function OrgExplorer(props: OrgExplorerProps): React.ReactElement {
    return <div>
        {displayAspects(props)}
        {displayDeveloper()}
    </div>;
}

function displayDeveloper(): React.ReactElement {
    return <div>
        <h2>Developer</h2>
        <ul>
            <li><a href="https://github.com/atomist-blogs/org-visualizer/blob/master/docs/developer.md">Developer
                Guide</a> - Developer documentation on <a href="https://github.com/atomist-blogs">GitHub</a></li>
            <li><a href="./api-docs">Swagger documentation</a> - Interactive documentation for API endpoints running on
                this server
            </li>
            <li><a href="./api/v1/*/fingerprint/npm-project-deps/tslint?byOrg=true">Example of backing JSON data</a> -
                Example tree structured data return
            </li>
        </ul>
    </div>;
}
