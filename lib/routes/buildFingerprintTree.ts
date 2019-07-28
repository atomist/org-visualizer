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

import { logger } from "@atomist/automation-client";
import {
    BaseAspect,
    ConcreteIdeal,
    FP,
    Ideal,
} from "@atomist/sdm-pack-fingerprints";
import { isConcreteIdeal } from "@atomist/sdm-pack-fingerprints/lib/machine/Ideal";
import { Client } from "pg";
import { AspectRegistry } from "../aspect/AspectRegistry";
import { fingerprintsToReposTree } from "../aspect/repoTree";
import {
    groupSiblings,
    introduceClassificationLayer,
    isSunburstTree,
    PlantedTree,
    SunburstTree,
    trimOuterRim,
    visit,
    visitAsync,
} from "../tree/sunburst";

import * as _ from "lodash";

/**
 * Return a tree from fingerprint name -> instances -> repos
 * @return {Promise<PlantedTree>}
 */
export async function buildFingerprintTree(
    world: {
        aspectRegistry: AspectRegistry,
        clientFactory: () => Client,
    },
    params: {
        workspaceId: string,
        fingerprintName: string,
        fingerprintType: string,
        byName: boolean,
        otherLabel: boolean,
        showPresence: boolean,
        byOrg: boolean,
        trim: boolean,
        showProgress: boolean,
    }): Promise<PlantedTree> {

    const { workspaceId, byName, fingerprintName, fingerprintType, otherLabel, showPresence, byOrg, trim, showProgress } = params;
    const { clientFactory, aspectRegistry } = world;

    // Get the tree and then perform post processing on it
    let pt = await fingerprintsToReposTree({
        workspaceId,
        clientFactory,
        byName,
        includeWithout: otherLabel,
        rootName: fingerprintName,
        aspectName: fingerprintType,
    });
    logger.debug("Returning fingerprint tree '%s': %j", fingerprintName, pt);

    await decorateProblemFingerprints(aspectRegistry, pt);

    const aspect = aspectRegistry.aspectOf(fingerprintType);

    if (!byName) {
        // Show all fingerprints in one aspect, splitting by fingerprint name
        pt = introduceClassificationLayer<{ data: any, type: string }>(pt,
            {
                descendantClassifier: l => {
                    if (!(l as any).sha) {
                        return undefined;
                    }
                    const aspect2: BaseAspect = aspectRegistry.aspectOf(l.type);
                    return !aspect2 || !aspect2.toDisplayableFingerprintName ?
                        l.name :
                        aspect2.toDisplayableFingerprintName(l.name);
                },
                newLayerDepth: 1,
                newLayerMeaning: "fingerprint name",
            });
        if (!!aspect) {
            pt.tree.name = aspect.displayName;
        }
    } else {
        // We are showing a particular fingerprint
        if (!!aspect) {
            pt.tree.name = aspect.toDisplayableFingerprintName ?
                aspect.toDisplayableFingerprintName(fingerprintName) :
                fingerprintName;
        }
    }

    resolveAspectNames(aspectRegistry, pt.tree);
    if (byOrg) {
        // Group by organization via an additional layer at the center
        pt = introduceClassificationLayer<{ owner: string }>(pt,
            {
                descendantClassifier: l => l.owner,
                newLayerDepth: 1,
                newLayerMeaning: "owner",
            });
    }
    if (showPresence) {
        pt.tree = groupSiblings(pt.tree,
            {
                parentSelector: parent => parent.children.some(c => (c as any).sha),
                childClassifier: kid => (kid as any).sha ? "Yes" : "No",
                collapseUnderName: name => name === "No",
            });
    } else if (showProgress) {
        const ideal = await aspectRegistry.idealStore.loadIdeal(workspaceId, fingerprintType, fingerprintName);
        if (!ideal || !isConcreteIdeal(ideal)) {
            throw new Error(`No ideal to aspire to for ${fingerprintType}/${fingerprintName} in workspace '${workspaceId}'`);
        }
        decorateToShowProgressToIdeal(aspectRegistry, pt, ideal);
    }

    applyTerminalSizing(aspect, pt.tree);

    // Group all fingerprint nodes by their name at the first level
    pt.tree = groupSiblings(pt.tree, {
        parentSelector: parent => parent.children.some(c => (c as any).sha),
        childClassifier: l => l.name,
        collapseUnderName: () => true,
    });

    if (trim) {
        pt.tree = trimOuterRim(pt.tree);
    }

    return pt;
}

function resolveAspectNames(aspectRegistry: AspectRegistry, t: SunburstTree): void {
    visit(t, l => {
        if ((l as any).sha) {
            const fp = l as any as FP;
            // It's a fingerprint name
            const aspect = aspectRegistry.aspectOf(fp.type);
            if (aspect) {
                fp.name = aspect.toDisplayableFingerprint ? aspect.toDisplayableFingerprint(fp) : fp.data;
            }
        }
        return true;
    });
}

/**
 * Size terminal nodes by aspect stat if available
 */
function applyTerminalSizing(aspect: BaseAspect, t: SunburstTree): void {
    if (aspect && aspect.stats && aspect.stats.basicStatsPath) {
        visit(t, l => {
            if (isSunburstTree(l) && l.children.every(c => !isSunburstTree(c) && (c as any).owner)) {
                l.children.forEach(c => (c as any).size = _.get(l, "data." + aspect.stats.basicStatsPath, 1));
            }
            return true;
        });
    }
}

async function decorateProblemFingerprints(aspectRegistry: AspectRegistry, pt: PlantedTree): Promise<void> {
    const usageChecker = await aspectRegistry.undesirableUsageCheckerFor("local");
    // Flag bad fingerprints with a special color
    await visitAsync(pt.tree, async l => {
        if ((l as any).sha) {
            const problem = await usageChecker.check("local", l as any);
            if (problem) {
                (l as any).color = "#810325";
                (l as any).problem = {
                    // Need to dispense with the fingerprint, which would make this circular
                    description: problem.description,
                    severity: problem.severity,
                    authority: problem.authority,
                    url: problem.url,
                };
            }
        }
        return true;
    });
}

function decorateToShowProgressToIdeal(aspectRegistry: AspectRegistry, pt: PlantedTree, ideal: ConcreteIdeal): void {
    pt.tree = groupSiblings(pt.tree, {
        parentSelector: parent => parent.children.some(c => (c as any).sha),
        childClassifier: kid => (kid as any).sha === ideal.ideal.sha ? "Ideal" : "No",
        groupLayerDecorator: l => {
            if (l.name === "Ideal") {
                (l as any).color = "#168115";
            } else {
                (l as any).color = "#811824";
            }
        },
    });
}
