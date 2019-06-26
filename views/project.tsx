import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import * as React from "react";

type DisplayName = string;

export interface FingerprintForDisplay {
    displayName: DisplayName;
    idealDisplayString: string;
    displayValue: string;
    style: React.CSSProperties;
}

export interface FeatureForDisplay {
    feature: { displayName: DisplayName };
    fingerprints: FingerprintForDisplay[];
}

export interface ProjectExplorerProps {
    analysis: ProjectAnalysis;
    features: FeatureForDisplay[];
}

export function ProjectExplorer(props: ProjectExplorerProps): React.ReactElement {
    return <div>
        <h1>Project {props.analysis.id.owner}:{props.analysis.id.repo}</h1>

        <a href={props.analysis.id.url}>Source</a>

        <h2>Architectural Concerns</h2>

        {props.features.map(displayFeature)}
    </div>;
}

function displayFeature(feature: FeatureForDisplay): React.ReactElement {
    return <div>
        <h3>{feature.feature.displayName}</h3>
        <ul>
            {feature.fingerprints.map(displayFingerprint)}
        </ul>
    </div>;
}

function displayFingerprint(fingerprint: FingerprintForDisplay): React.ReactElement {
    return <li style={fingerprint.style} key={fingerprint.displayName}>
        <i>{fingerprint.displayName}</i>: {fingerprint.displayValue}
        {" "} (Ideal: {fingerprint.idealDisplayString || "none"})
    </li>;
}
