/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LocalProject } from "@atomist/automation-client";
import {
    LoggingProgressLog,
    spawnLog,
    StringCapturingProgressLog,
} from "@atomist/sdm";
import {
    ApplyFingerprint,
    Aspect,
    DefaultTargetDiffHandler,
    diffOnlyHandler,
    DiffSummaryFingerprint,
    ExtractFingerprint,
    FP,
    sha256,
    Vote,
} from "@atomist/sdm-pack-fingerprints";
import { setNewTargetFingerprint } from "@atomist/sdm-pack-fingerprints/lib/handlers/commands/updateTarget";
import {
    bold,
    codeLine,
} from "@atomist/slack-messages";
import * as _ from "lodash";
import { idealsFromNpm } from "./idealFromNpm";

/**
 * [lib, version]
 */
export type NpmDepData = string[];

/**
 * Construct an npmdep fingerprint from the given library and version
 * @param {string} lib
 * @param {string} version
 * @return {FP}
 */
export function createNpmDepFingerprint(lib: string, version: string): FP<NpmDepData> {
    const data = [lib, version];
    return {
        type: NpmDepsName,
        name: `${constructNpmDepsFingerprintName(lib)}`,
        abbreviation: "npmdeps",
        version: "0.0.1",
        data,
        sha: sha256(JSON.stringify(data)),
    };
}

export function constructNpmDepsFingerprintName(lib: string): string {
    return `${lib.replace("@", "").replace("/", "::")}`;
}

/**
 * Return the library name in its natural form - e.g. "lodash" or "@types/lodash" or "@atomist/sdm"
 * @param {string} fingerprintName
 * @return {string | undefined}
 */
export function deconstructNpmDepsFingerprintName(fingerprintName: string): string | undefined {
    const regex = /^([^:]+)(::.*)?$/;
    const match = regex.exec(fingerprintName);
    if (!match) {
        return undefined;
    }
    if (match[2] !== undefined) {
        const lib = match[2].replace("::", "");
        const owner = match[1];
        return `@${owner}/${lib}`;
    } else {
        const lib = match[1];
        return lib;
    }
}

export const createNpmDepsFingerprints: ExtractFingerprint<NpmDepData> = async p => {
    const file = await p.getFile("package.json");

    if (file) {
        const jsonData = JSON.parse(await file.getContent());
        const dependencies = _.merge(jsonData.dependencies || {}, jsonData.devDependencies || {});

        const fingerprints: FP[] = [];

        for (const [lib, version] of Object.entries(dependencies)) {
            fingerprints.push(createNpmDepFingerprint(lib, version as string));
        }

        return fingerprints;
    } else {
        return undefined;
    }
};

export const createNpmCoordinatesFingerprint: ExtractFingerprint = async p => {
    const file = await p.getFile("package.json");

    if (file) {
        const jsonData = JSON.parse(await file.getContent());

        const fingerprints: FP[] = [];

        const coords = { name: jsonData.name, version: jsonData.version };
        fingerprints.push(
            {
                type: NpmCoordinates.name,
                name: NpmCoordinates.name,
                abbreviation: NpmCoordinates.name,
                version: "0.0.1",
                data: coords,
                sha: sha256(JSON.stringify(coords)),
            },
        );

        return fingerprints;
    } else {
        return undefined;
    }

};

export const applyNpmDepsFingerprint: ApplyFingerprint<NpmDepData> = async (p, papi) => {
    const fp = papi.parameters.fp;
    const pckage = fp.data[0];
    const version = fp.data[1];
    const file = await p.getFile("package.json");
    if (!!file) {
        const pj = (await file.getContent())
            .replace(new RegExp(`"${pckage}":\\s*".*"`, "g"), `"${pckage}": "${version}"`);
        await file.setContent(pj);
        const log = new StringCapturingProgressLog();
        log.stripAnsi = true;
        const result = await spawnLog(
            "npm",
            ["install"],
            {
                cwd: (p as LocalProject).baseDir,
                log,
                logCommand: true,
            });
        if (result.code !== 0) {
            return {
                edited: false,
                success: false,
                error: new Error(`npm installed failed:\n\n${log.log}`),
                target: p,
            };
        }
    }

    return p;
};

/* tslint:disable:max-line-length */
export const diffNpmDepsFingerprints: DiffSummaryFingerprint = (diff, target) => {
    return {
        title: "New NPM Package Policy",
        description:
            `Policy version for NPM package ${bold(diff.from.data[0])} is ${codeLine(target.data[1])}.\nProject ${bold(`${diff.owner}/${diff.repo}/${diff.branch}`)} is currently configured to use version ${codeLine(diff.to.data[1])}.`,
    };
};

/* tslint:disable:max-line-length */
export const diffNpmCoordinatesFingerprints: DiffSummaryFingerprint = (diff, target) => {
    return {
        title: "New Package Coordinate Updated",
        description: `from ${diff.from.data} to ${diff.to.data}`,
    };
};

const NpmDepsName = "npm-project-deps";

/**
 * Aspect emitting 0 or more npm dependencies fingerprints.
 */
export const NpmDependencies: Aspect<NpmDepData> = {
    displayName: "NPM dependencies",
    name: NpmDepsName,
    extract: createNpmDepsFingerprints,
    apply: applyNpmDepsFingerprint,
    summary: diffNpmDepsFingerprints,
    toDisplayableFingerprint: fp => fp.data[1],
    toDisplayableFingerprintName: deconstructNpmDepsFingerprintName,
    workflows: [
        DefaultTargetDiffHandler,
    ],
    suggestedIdeals: (type, name) => idealsFromNpm(name),
};

export const NpmCoordinates: Aspect = {
    displayName: "NPM coordinates",
    name: "npm-project-coordinates",
    extract: createNpmCoordinatesFingerprint,
    summary: diffNpmCoordinatesFingerprints,
    toDisplayableFingerprint: fp => fp.data,
    workflows: [
        diffOnlyHandler(
            async (ctx, diffs) => {
                const votes: Vote[] = [];
                for (const diff of diffs) {
                    if (diff.channel) {
                        votes.push(await setNewTargetFingerprint(
                            ctx.context,
                            NpmDependencies,
                            createNpmDepFingerprint(diff.to.data.name, diff.to.data.version),
                            diff.channel));
                    } else {
                        votes.push({ abstain: true });
                    }
                }
                return votes;
            },
        ),
    ],
};
