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

import {
    logger,
    ProjectFile,
    projectUtils,
} from "@atomist/automation-client";
import {
    ApplyFingerprint,
    Aspect,
    DefaultTargetDiffHandler,
    DiffSummaryFingerprint,
    ExtractFingerprint,
    FP,
    sha256,
} from "@atomist/sdm-pack-fingerprints";
import { bold } from "@atomist/slack-messages";
import * as stringify from "json-stable-stringify";
import * as _ from "lodash";
import * as yaml from "yamljs";

const K8sSpecsType = "k8s-specs";

export interface K8sObject {
    apiVersion: string;
    kind: string;
    metadata: {
        name: string;
        namespace?: string;
        labels?: Record<string, string>;
    };
}

/**
 * Construct a Kubernetes spec fingerprint.
 *
 * @param spec Object representation of Kubernetes spec.
 * @return Fingerprint of spec
 */
export function createK8sSpecFingerprint(spec: K8sObject): FP<K8sObject> {
    if (spec.metadata && spec.metadata.labels && spec.metadata.labels["app.kubernetes.io/managed-by"]) {
        delete spec.metadata.labels["app.kubernetes.io/managed-by"];
    }
    const s: any = spec;
    if (s.spec && s.spec.template && s.spec.template.metadata && s.spec.template.metadata.labels &&
        s.spec.template.metadata.labels["app.kubernetes.io/managed-by"]) {
        delete s.spec.template.metadata.labels["app.kubernetes.io/managed-by"];
    }
    return {
        type: K8sSpecsType,
        name: `${k8sSpecsFingerprintName(spec)}`,
        abbreviation: "k8sspecs",
        version: "0.0.1",
        data: spec,
        sha: sha256(stringify(spec)),
    };
}

export function k8sSpecsFingerprintName(spec: K8sObject): string {
    if (!isK8sSpec(spec)) {
        throw new Error(`The provided Kubernetes spec is not valid: ${stringify(spec)}`);
    }
    const ns = (spec.metadata.namespace) ? `${spec.metadata.namespace}::` : "";
    return `${spec.kind}::${ns}${spec.metadata.name}`;
}

/**
 * Return the fingerprint name in format similar to resource name.
 *
 * @param fingerprintName internal fingerprint name
 * @return Human-readable name
 */
export function k8sSpecsFingerprintDisplayName(fingerprintName: string): string {
    return fingerprintName.replace(/::/g, "/");
}

/**
 * Read file, parse, and verify it looks like a Kubernetes spec.  If so,
 * it returns the parse spec object.  If not, it returns `undefined`.
 */
export async function parseK8sSpecFile(f: ProjectFile): Promise<K8sObject | undefined> {
    const specString = await f.getContent();
    try {
        const spec = yaml.parse(specString);
        if (isK8sSpec(spec)) {
            return spec;
        }
    } catch (e) {
        logger.warn(`Failed to parse ${f.name}, skipping: ${e.message}`);
    }
    return undefined;
}

/**
 * Test if the provided object looks like a valid Kubernetes resource object.
 */
export function isK8sSpec(o: any): o is K8sObject {
    return o.apiVersion && o.kind && o.metadata && o.metadata.name;
}

const k8sSpecGlob = "*.@(json|yaml|yml)";

export const createK8sSpecsFingerprints: ExtractFingerprint<FP<K8sObject>> = async p => {
    const fingerprints: Array<FP<K8sObject>> = [];
    await projectUtils.doWithFiles(p, k8sSpecGlob, async f => {
        const spec = await parseK8sSpecFile(f);
        if (spec) {
            fingerprints.push(createK8sSpecFingerprint(spec));
        }
    });
    return fingerprints;
};

export const applyK8sSpecsFingerprint: ApplyFingerprint<FP<K8sObject>> = async (p, fp) => {
    const specFiles = await projectUtils.toPromise(p.streamFiles(k8sSpecGlob));
    for (const specFile of specFiles) {
        const spec = await parseK8sSpecFile(specFile);
        if (spec && k8sSpecsFingerprintName(spec) === fp.name) {
            const specString = (/\.ya?ml$/.test(specFile.name)) ? yaml.stringify(fp.data) : stringify(fp.data);
            await specFile.setContent(specString);
            return true;
        }
    }
    return false;
};

export const diffK8sSpecsFingerprints: DiffSummaryFingerprint = (diff, target) => {
    const resourceName = k8sSpecsFingerprintDisplayName(k8sSpecsFingerprintName(diff.from.data));
    const repo = `${diff.owner}/${diff.repo}/${diff.branch}`;
    return {
        title: "New Kubernetes Spec Policy",
        description: `Policy version for Kubernetes spec ${bold(resourceName)} differs from that in ${bold(repo)}.`,
    };
};

/**
 * Aspect emitting 0 or more npm dependencies fingerprints.
 */
export const NpmDeps: Aspect<FP<K8sObject>> = {
    displayName: "Kubernetes specs",
    name: K8sSpecsType,
    extract: createK8sSpecsFingerprints,
    apply: applyK8sSpecsFingerprint,
    summary: diffK8sSpecsFingerprints,
    toDisplayableFingerprint: fp => fp.data[1],
    toDisplayableFingerprintName: k8sSpecsFingerprintDisplayName,
    workflows: [
        DefaultTargetDiffHandler,
    ],
};
