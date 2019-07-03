import { Feature, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { findDeclaredDependencies } from "@atomist/sdm-pack-spring/lib/maven/parse/fromPom";
import { VersionedArtifact } from "@atomist/sdm-pack-spring";

const SpringBootStarterType = "spring-boot-starter";

export interface SpringBootStarterFingerprint extends FP {
    data: VersionedArtifact;
}

export const SpringBootStarterFeature: Feature<SpringBootStarterFingerprint> = {
    name: SpringBootStarterType,
    displayName: "Spring Boot Starter",
    extract: async p => {
        const deps = await findDeclaredDependencies(p);
        if (deps.dependencies.length === 0) {
            return undefined;
        }
        return deps.dependencies
            .filter(d => d.artifact.includes("-starter"))
            .map(createSpringBootStarterFingerprint);
    },
    toDisplayableFingerprint: fp => fp.data.version || "inherited",
    selector: fp => fp.type === SpringBootStarterType,
};

function createSpringBootStarterFingerprint(data: VersionedArtifact): SpringBootStarterFingerprint {
    return {
        type: SpringBootStarterType,
        name: `${data.group}:${data.artifact}`,
        data,
        sha: sha256(JSON.stringify(data))
    }
}
