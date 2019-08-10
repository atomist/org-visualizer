import { WeightedScores } from "@atomist/sdm-pack-analysis";
import * as React from "react";
import { ScoredRepo } from "../lib/aspect/AspectRegistry";
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
        <h1>Repository {props.repo.repoRef.owner}:{props.repo.repoRef.repo}</h1>

        <h2>Scoring</h2>

        <div className="score">{props.repo.weightedScore.weightedScore.toFixed(2)}</div>
        <br/>
        {displayWeightedScores(props.repo.weightedScore.weightedScores)}

        <h2>Resources</h2>
        <ul>
            <li><a href={props.repo.repoRef.url}>Source</a></li>
        </ul>

        <h2>Tags Found</h2>

        {displayTags(props)}

        <h2>Aspects Found</h2>

        {displayAspects(props)}
    </div>;
}

function displayWeightedScores(weightedScores: WeightedScores): React.ReactElement {
    return collapsible("weightedScores", "Score components",
        <ul>
            {Object.getOwnPropertyNames(weightedScores).map(name => {
                const score = weightedScores[name];
                return <li><b>{score.name}</b>: {score.score} (x{score.weighting}) - {score.reason}</li>;
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
        false);
}

function displayAspect(feature: ProjectAspectForDisplay): React.ReactElement {
    return <div>
        <h3>{feature.aspect.displayName}</h3>
        <ul>
            {feature.fingerprints.map(displayFingerprint)}
        </ul>
    </div>;
}

function displayTags(props: RepoExplorerProps): React.ReactElement {
    return collapsible("tags", "Tags Found",
        <ul>
            {props.repo.tags.map(displayTag)}
        </ul>,
        true);
}

function displayTag(tag: TagUsage): React.ReactElement {
    return <ul>
        <li><b>{tag.name}</b> - {tag.description}</li>
    </ul>;
}

function displayFingerprint(fingerprint: ProjectFingerprintForDisplay): React.ReactElement {
    return <li style={fingerprint.style} key={fingerprint.displayName}>
        <i>{fingerprint.displayName}</i>: {fingerprint.displayValue}
        {" "} {fingerprint.idealDisplayString && `(Ideal: ${fingerprint.idealDisplayString})`}
    </li>;
}
