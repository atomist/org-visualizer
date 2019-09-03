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

import { projectUtils } from "@atomist/automation-client";
import { Microgrammar } from "@atomist/microgrammar";
import {
    Aspect,
    DefaultTargetDiffHandler,
    FP,
    sha256,
} from "@atomist/sdm-pack-fingerprint";
import { VersionedArtifact } from "@atomist/sdm-pack-spring";
import {
    bold,
    codeLine,
} from "@atomist/slack-messages";
import * as _ from "lodash";

const MavenParentPomType = "maven-parent-pom";

export const LEGAL_VALUE = /[\[\]\(\),a-zA-Z_\.0-9\-]+/;

const VERSION = {
    lx2: "<version>",
    version: LEGAL_VALUE,
    rx2: "</version>",
};

export const PARENT_GRAMMAR = Microgrammar.fromDefinitions({
    _lx1: "<parent>",
    lx1: "<groupId>",
    group: LEGAL_VALUE,
    rx1: "</groupId>",
    lx: "<artifactId>",
    artifact: LEGAL_VALUE,
    rx: "</artifactId>",
    ...VERSION,
});

export const MavenParentPom: Aspect<VersionedArtifact> = {
    name: MavenParentPomType,
    displayName: "Maven parent POM",
    summary: (diff, target) => {
        return {
            title: "New Maven Parent POM Version Policy",
            description:
                `Policy version for Maven dependency ${bold(`${diff.from.data.group}:${diff.from.data.artifact}`)} is ${codeLine(target.data.version)}.
Project ${bold(`${diff.owner}/${diff.repo}/${diff.branch}`)} is currently using version ${codeLine(diff.to.data.version)}.`,
        };
    },
    extract: async p => {
        return _.flatten(await projectUtils.gatherFromFiles<Array<FP<VersionedArtifact>>>(p, "**/pom.xml", async f => {
            const pom = await f.getContent();
            const matches = PARENT_GRAMMAR.findMatches(pom) as VersionedArtifact[];
            return matches.map(gavToFingerprint);
        }));
    },
    apply: async (p, papi) => {
        await projectUtils.doWithFiles(p, "**/pom.xml", async f => {
            const pom = await f.getContent();
            const matches = PARENT_GRAMMAR.findMatches(pom) as VersionedArtifact[];
            if (matches.length === 0) {
                return;
            }
            const fp = papi.parameters.fp;
            const artifact = fp.data;
            const artifactToUpdate = matches.find(m => m.group === artifact.group && m.artifact === artifact.artifact);
            if (!!artifactToUpdate) {
                const updater = Microgrammar.updatableMatch(artifactToUpdate as any, pom);
                updater.version = artifact.version;
                await f.setContent(updater.newContent());
            }
        });
        return p;
    },
    toDisplayableFingerprintName: name => name,
    toDisplayableFingerprint: fp => fp.data.version,
    workflows: [
        DefaultTargetDiffHandler,
    ],
};

function gavToFingerprint(gav: VersionedArtifact): FP {
    const data = {
        group: gav.group,
        artifact: gav.artifact,
        version: !gav.version ? "managed" : gav.version,
    };
    return {
        type: MavenParentPomType,
        name: `${gav.group}:${gav.artifact}`,
        abbreviation: "mvnp",
        version: "0.1.0",
        data,
        sha: sha256(JSON.stringify(data)),
    };
}
