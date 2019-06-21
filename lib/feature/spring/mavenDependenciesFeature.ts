import { Feature, FP, sha256 } from "@atomist/sdm-pack-fingerprints";
import { findDependenciesFromEffectivePom, VersionedArtifact } from "@atomist/sdm-pack-spring";

const MavenDirectDepType = "maven-direct-dep";

const MavenTransitiveDepType = "maven-transitive-dep";

/**
 * Emits direct and transitive dependencies
 */
export const mavenDependenciesFeature: Feature = {
    name: "maven-deps",
    displayName: "Maven dependencies",
    extract: async p => {
        const pom = await p.getFile("pom.xml");
        if (!pom) {
            return undefined;
        }
        const pomContent = await pom.getContent();
        const allDeps = await findDependenciesFromEffectivePom(p);
        return allDeps
            .map(dep => ({
                ...dep,
                // TODO this is probably wrong
                direct: pomContent.includes(`<group>${dep.group}</group>`) &&
                pomContent.includes(`<artifact>${dep.group}</artifact>`),
            }))
            .map(dep => gavToFingerprint(dep));
    },
    apply: async (p, fp) => {
        // TODO unimplemented
        return false;
    },
    selector: fp => [MavenDirectDepType, MavenTransitiveDepType].includes(fp.type),
    toDisplayableFingerprintName: name => name,
    toDisplayableFingerprint: fp => {
        const version = JSON.parse(fp.data).version;
        return version;
    },
};

function gavToFingerprint(gav: VersionedArtifact & { direct: boolean }): FP {
    const data = JSON.stringify(gav);
    return {
        type: gav.direct ? MavenDirectDepType : MavenTransitiveDepType,
        name: `${gav.group}:${gav.artifact}`,
        abbreviation: "mvn",
        version: "0.1.0",
        data,
        sha: sha256(data),
    };
}