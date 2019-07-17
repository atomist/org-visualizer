import { Feature, sha256 } from "@atomist/sdm-pack-fingerprints";
import { sniffProject } from "./secretSniffing";
import { loadSnifferOptions } from "./snifferOptionsLoader";

const ExposedSecretsType = "exposed-secret";

export const ExposedSecrets: Feature = {
    name: ExposedSecretsType,
    displayName: "Exposed secrets",
    extract: async p => {
        const exposedSecretsResult = await sniffProject(p, await loadSnifferOptions());
        return exposedSecretsResult.exposedSecrets.map(es => {
            const data = {
                secret: es.secret,
                path: es.path,
                description: es.description,
            };
            return {
                type: ExposedSecretsType,
                name: ExposedSecretsType,
                data,
                sha: sha256(data),
            }
        })
    },
    toDisplayableFingerprintName: name => name,
    toDisplayableFingerprint: fp => `${fp.data.path}:${fp.data.description}`,
};
