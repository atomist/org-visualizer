import * as React from "react";
import { TaggedRepo } from "../lib/routes/support/tagUtils";
import { TagUsage } from "../lib/tree/sunburst";

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
    taggedRepo: TaggedRepo;
    aspects: ProjectAspectForDisplay[];
}

export function RepoExplorer(props: RepoExplorerProps): React.ReactElement {
    return <div>
        <h1>Repository {props.taggedRepo.repoRef.owner}:{props.taggedRepo.repoRef.repo}</h1>

        <h2>Resources</h2>
        <ul>
            <li><a href={props.taggedRepo.repoRef.url}>Source</a></li>
        </ul>

        <h2>Tags Found</h2>

        {props.taggedRepo.tags.map(displayTag)}

        <h2>Aspects Found</h2>

        {props.aspects.map(displayAspect)}
    </div>;
}

function displayAspect(feature: ProjectAspectForDisplay): React.ReactElement {
    return <div>
        <h3>{feature.aspect.displayName}</h3>
        <ul>
            {feature.fingerprints.map(displayFingerprint)}
        </ul>
    </div>;
}

function displayTag(tag: TagUsage): React.ReactElement {
    return <ul>
        <li>{tag.name} - {tag.description}</li>
    </ul>;
}

function displayFingerprint(fingerprint: ProjectFingerprintForDisplay): React.ReactElement {
    return <li style={fingerprint.style} key={fingerprint.displayName}>
        <i>{fingerprint.displayName}</i>: {fingerprint.displayValue}
        {" "} {fingerprint.idealDisplayString && `(Ideal: ${fingerprint.idealDisplayString})` }
    </li>;
}
