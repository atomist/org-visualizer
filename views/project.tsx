import * as React from "react";

type DisplayName = string;

export interface FingerprintForDisplay {
    displayName: DisplayName;
    idealDisplayString: string;
    stringified: string;
    style: React.CSSProperties;
}

export interface FeatureForDisplay {
    feature: { displayName: DisplayName };
    fingerprints: FingerprintForDisplay[];
}

export interface ProjectExplorerProps {
    owner: string;
    repo: string;
    features: FeatureForDisplay[];
}

export function ProjectExplorer(props: ProjectExplorerProps): React.ReactElement {
    return <div>
        <h1>Project {props.owner}:{props.repo}</h1>

        This is a good project

        <h2>Features</h2>

        {props.features.map(displayFeature)};
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
    return <li style={fingerprint.style}>
        <i>{fingerprint.displayName}</i>: {fingerprint.stringified}
        {" "} (Ideal: {fingerprint.idealDisplayString || "none"})
    </li>;
}
