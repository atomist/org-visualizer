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
    Ideal,
    idealCoordinates,
    isConcreteIdeal,
    supportsEntropy,
} from "@atomist/sdm-pack-fingerprints";
import {
    Express,
    RequestHandler,
} from "express";
import * as _ from "lodash";
import {
    AspectFingerprintsForDisplay,
    FingerprintForDisplay,
    OrgExplorer,
} from "../../../views/overview";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
} from "../../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    AspectRegistry,
    ManagedAspect,
} from "../../aspect/AspectRegistry";
import { defaultedToDisplayableFingerprintName } from "../../aspect/DefaultAspectRegistry";

export function exposeOrgPage(express: Express,
                              handlers: RequestHandler[],
                              orgRoute: string,
                              aspectRegistry: AspectRegistry,
                              store: ProjectAnalysisResultStore): void {
    express.get(orgRoute, ...handlers, async (req, res) => {
        try {
            const repos = await store.loadInWorkspace(req.query.workspace || req.params.workspace_id, false);
            const workspaceId = "*";
            const fingerprintUsage = await store.fingerprintUsageForType(workspaceId);

            const ideals = await aspectRegistry.idealStore.loadIdeals(workspaceId);

            const aspectsEligibleForDisplay = aspectRegistry.aspects.filter(a => !!a.displayName)
                .filter(a => fingerprintUsage.some(fu => fu.type === a.name));
            const importantAspects: AspectFingerprintsForDisplay[] = _.sortBy(aspectsEligibleForDisplay, a => a.displayName)
                .map(aspect => {
                    const fingerprintsForThisAspect = fingerprintUsage.filter(fu => fu.type === aspect.name);
                    return {
                        aspect,
                        fingerprints: fingerprintsForThisAspect
                            .map(fp => formatFingerprintUsageForDisplay(aspect, ideals, fp)),
                    };
                });

            const unfoundAspects: BaseAspect[] = aspectRegistry.aspects
                .filter(f => !!f.displayName)
                .filter(f => !fingerprintUsage.some(fu => fu.type === f.name));
            const virtualProjectCount = await store.virtualProjectCount(workspaceId);

            res.send(renderStaticReactNode(
                OrgExplorer({
                    projectsAnalyzed: repos.length,
                    importantAspects,
                    unfoundAspects,
                    repos: repos.map(r => ({
                        id: r.id,
                        repo: r.repoRef.repo,
                        owner: r.repoRef.owner,
                        url: r.repoRef.url,
                    })),
                    virtualProjectCount,
                }), "Atomist Visualizer"));
        } catch (e) {
            logger.error(e.stack);
            res.status(500).send("failure");
        }
    });
}

function idealMatchesFingerprint(id: Ideal, fp: FingerprintUsage): boolean {
    const c = idealCoordinates(id);
    return c.type === fp.type && c.name === fp.name;
}

function formatFingerprintUsageForDisplay(aspect: ManagedAspect, ideals: Ideal[], fp: FingerprintUsage): FingerprintForDisplay {
    const foundIdeal = ideals.find(ide => idealMatchesFingerprint(ide, fp));
    const ideal = foundIdeal && isConcreteIdeal(foundIdeal) && aspect.toDisplayableFingerprint ?
        { displayValue: aspect.toDisplayableFingerprint(foundIdeal.ideal) }
        : undefined;
    return {
        ...fp,
        ideal,
        displayName: defaultedToDisplayableFingerprintName(aspect)(fp.name),
        entropy: supportsEntropy(aspect) ? fp.entropy : undefined,
    };
}
