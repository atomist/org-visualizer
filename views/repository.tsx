import { WeightedScore, WeightedScores } from "@atomist/sdm-pack-analysis";
import * as React from "react";
import { ScoredRepo } from "../lib/aspect/AspectRegistry";
import { isCodeMetricsFingerprint } from "../lib/aspect/common/codeMetrics";
import { TagUsage } from "../lib/tree/sunburst";
import { collapsible } from "./utils";

type DisplayName = string;

export interface ProjectFingerprintForDisplay {
    displayName: DisplayName;
    idealDisplayString: string;
    displayValue: string;
    style: React.CSSProperties;
}

export interface ProjectAspectForDisplay {
    aspect: { displayName: DisplayName };
    fingerprints: ProjectFingerprintForDisplay[];
}

export interface RepoExplorerProps {
    repo: ScoredRepo;
    aspects: ProjectAspectForDisplay[];
}

export function RepoExplorer(props: RepoExplorerProps): React.ReactElement {
    return <div>
        <h1>{props.repo.repoRef.owner} / <a href={props.repo.repoRef.url}>{props.repo.repoRef.repo}</a></h1>

        {displayWeightedScores(props.repo.weightedScore)}

        {displayTags(props)}

        {displayCodeMetrics(props)}

        {displayAspects(props)}

        {displayRawFingerprints(props)}

        {displayResources(props)}

    </div>;
}

function displayRawFingerprints(props: RepoExplorerProps): React.ReactElement {
    return collapsible("raw-fp", "Raw Fingerprints",
        <pre>
        {JSON.stringify(props.repo.analysis.fingerprints, null, 2)}
        </pre>,
        false);

}

function displayResources(props: RepoExplorerProps): React.ReactElement {
    return collapsible("Resources", "Resources",
        <ul>
            <li>Source - <a href={props.repo.repoRef.url} target="_blank">{props.repo.repoRef.url}</a></li>
            <li><a href={props.repo.repoRef.cloneUrl(undefined)}>Clone
                URL</a> - {props.repo.repoRef.cloneUrl(undefined)}</li>
        </ul>, true);
}

function displayWeightedScores(weightedScore: WeightedScore): React.ReactElement {
    return collapsible("weightedScores",
        `Score: ${weightedScore.weightedScore.toFixed(2)} / 5`,
        <ul>
            {Object.getOwnPropertyNames(weightedScore.weightedScores).map(name => {
                const score = weightedScore.weightedScores[name];
                return <li><b>{score.name}</b>: {score.score.toFixed(2)} (x{score.weighting}) - {score.reason}</li>;
            })
            }
        </ul>,
        true);
}

function displayAspects(props: RepoExplorerProps): React.ReactElement {
    return collapsible("aspects", "Aspects",
        <ul>
            {props.aspects.map(displayAspect)}
        </ul>,
        true);
}

function displayAspect(feature: ProjectAspectForDisplay): React.ReactElement {
    return <li>
        {collapsible("aspects",
            feature.aspect.displayName,
            <ul>
                {feature.fingerprints.map(displayFingerprint)}
            </ul>,
            true)}
    </li>;
}

function displayTags(props: RepoExplorerProps): React.ReactElement {
    return collapsible("tags", "Tags",
        <ul>
            {props.repo.tags.map(displayTag)}
        </ul>,
        true);
}

function displayTag(tag: TagUsage): React.ReactElement {
    return <li><b>{tag.name}</b> - {tag.description}</li>;
}

function displayFingerprint(fingerprint: ProjectFingerprintForDisplay): React.ReactElement {
    return <li style={fingerprint.style} key={fingerprint.displayName}>
        <i>{fingerprint.displayName}</i>: {fingerprint.displayValue}
        {" "} {fingerprint.idealDisplayString && `(Ideal: ${fingerprint.idealDisplayString})`}
    </li>;
}

function displayCodeMetrics(props: RepoExplorerProps): React.ReactElement {
    const cmf = props.repo.analysis.fingerprints.find(isCodeMetricsFingerprint);
    if (!cmf) {
        return <div/>;
    }

    return collapsible("languages", "Languages",
        <ul>
            {cmf.data.languages.map(lang => {
                return <li key={"lang_" + lang}><b>{lang.language.name}</b>: {lang.total}</li>;
            })}
        </ul>,
        true);
}
