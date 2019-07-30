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
} from "@atomist/sdm";
import {
    ApplyFingerprint,
    Aspect,
    DefaultTargetDiffHandler,
    DiffSummaryFingerprint,
    ExtractFingerprint,
    FP,
    sha256,
} from "@atomist/sdm-pack-fingerprints";
import {
    bold,
    codeLine,
} from "@atomist/slack-messages";
import * as _ from "lodash";
import * as semver from "semver";

const SdmPackages = [
    "@atomist/automation-client",
    "@atomist/sdm",
    "@atomist/sdm-core",
];

interface NpmPackage {
    name: string;
    version: string;
}

export function createSdmDepFingerprint(packages: NpmPackage[]): FP {
    return {
        type: SdmDepsName,
        name: SdmDepsName,
        abbreviation: "sdmdeps",
        version: "0.0.1",
        data: packages,
        sha: sha256(JSON.stringify(packages)),
    };
}

export const createSdmDepsFingerprints: ExtractFingerprint = async p => {
    const file = await p.getFile("package.json");

    if (!!file) {
        const pj = JSON.parse(await file.getContent());

        // Don't calcuate that fingerprint one of the SDM packages itself as those
        // iterate at different speeds
        const name = pj.name;
        if (SdmPackages.includes(name)) {
            return undefined;
        }

        const sdmPackages: NpmPackage[] = [];

        const dependencies = pj.dependencies || {};
        SdmPackages.filter(pk => !!dependencies[pk]).forEach(pk => sdmPackages.push({
            name: pk,
            version: dependencies[pk],
        }));

        const devDependencies = pj.devDependencies || {};
        SdmPackages.filter(pk => !!devDependencies[pk]).forEach(pk => sdmPackages.push({
            name: pk,
            version: devDependencies[pk],
        }));

        return createSdmDepFingerprint(sdmPackages);
    } else {
        return undefined;
    }
};

export const applySdmDepsFingerprint: ApplyFingerprint = async (p, fp) => {
    const file = await p.getFile("package.json");
    if (!!file) {
        const pj = JSON.parse(await file.getContent());

        const sdmPackages = fp.data as NpmPackage[];

        sdmPackages.forEach(pk => {
            // Set version throughout
            if (!!_.get(pj.dependencies, pk.name)) {
                pj.dependencies[pk.name] = pk.version;
            }
            if (!!_.get(pj.devDependencies, pk.name)) {
                pj.devDependencies[pk.name] = pk.version;
            }

            // Fix up peerDependency entries

            if (!!_.get(pj.peerDependencies, p.name)) {
                const version = pk.version.replace(/\^/g, "");
                const peerVersion = `>=${semver.major(version)}.${semver.minor(version)}.0`;
                pj.peerDependencies[pk.name] = peerVersion;
            }
        });

        await file.setContent(JSON.stringify(pj));
        const log = new LoggingProgressLog("npm install");
        const result = await spawnLog(
            "npm",
            ["install"],
            {
                cwd: (p as LocalProject).baseDir,
                log,
                logCommand: true,
            });
        return result.code === 0;
    } else {
        return false;
    }
};

export const diffNpmDepsFingerprints: DiffSummaryFingerprint = (diff, target) => {
    return {
        title: "New SDM Version Target",
        description:
            `Target versions for SDM packages are:
${(target.data as NpmPackage[]).map(p => codeLine(`${p.name}@${p.version}`)).join("\n")}

Project ${bold(`${diff.owner}/${diff.repo}/${diff.branch}`)} is currently configured to use versions:
${(diff.to.data as NpmPackage[]).map(p => codeLine(`${p.name}@${p.version}`))}`,
    };
};

const SdmDepsName = "sdm-deps";

export const SdmDeps: Aspect = {
    name: SdmDepsName,
    displayName: "SDM packages",
    extract: createSdmDepsFingerprints,
    apply: applySdmDepsFingerprint,
    summary: diffNpmDepsFingerprints,
    toDisplayableFingerprint: fp => (fp.data as NpmPackage[]).map(d => `${d.name.split("/")[1]}@${d.version}`).join(", "),
    toDisplayableFingerprintName: () => "SDM packages",
    workflows: [
        DefaultTargetDiffHandler,
    ],
};
