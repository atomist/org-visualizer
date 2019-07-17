import { SecretDefinition, SnifferOptions } from "./secretSniffing";

import * as yaml from "yamljs";

import * as fs from "fs";
import * as path from "path";
import { AllFiles } from "@atomist/automation-client";

/**
 * Based on regular expressions in https://www.ndss-symposium.org/wp-content/uploads/2019/02/ndss2019_04B-3_Meli_paper.pdf
 * @type {any[]}
 */
export async function loadSnifferOptions(): Promise<SnifferOptions> {
    const secretsYmlPath = path.join(__dirname, "..", "..", "..", "secrets.yml");
    const yamlString = fs.readFileSync(secretsYmlPath, 'utf8');
    try {
        const native = await yaml.parse(yamlString);

        const secretDefinitions: SecretDefinition[] = native.secrets
            .map((s: any) => s.secret)
            .map((s: any) => ({
                pattern: new RegExp(s.pattern, "g"),
                description: s.description,
            }));

        return {
            secretDefinitions,
            whitelist: native.whitelist || [],
            globs: native.globs || [AllFiles],
            scanOnlyChangedFiles: native.scanOnlyChangedFiles || false,
        };
    } catch (err) {
        throw new Error(`Unable to parse secrets.yml: ${err.message}`);
    }
}
