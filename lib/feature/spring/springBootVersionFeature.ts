import { Feature, sha256 } from "@atomist/sdm-pack-fingerprints";
import { setSpringBootVersionTransform, SpringBootVersionInspection } from "@atomist/sdm-pack-spring";

const SpringBootVersionType = "spring-boot-version";

export const springBootVersionFeature: Feature = {
    name: "springVersion",
    displayName: "Spring Version",

    extract: async p => {
        const versions = await SpringBootVersionInspection(p, undefined);
        if (!versions || versions.versions.length === 0) {
            return undefined;
        }
        return {
            type: SpringBootVersionType,
            name: SpringBootVersionType,
            abbreviation: "sbv",
            version: "0.1.0",
            data: versions,
            sha: sha256(JSON.stringify(versions)),
        }
    },
    apply: async (p, fp) => {
        if (fp.data.length !== 1) {
            return false;
        }
        await setSpringBootVersionTransform(fp.data[0]);
        return true;
    },
    selector: fp => fp.type === SpringBootVersionType,
    toDisplayableFingerprintName: () => "Spring Boot version",
    toDisplayableFingerprint: fp => `Spring Boot v ${fp.data.join(",")}`,
};
