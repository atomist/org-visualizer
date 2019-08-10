import { logger } from "@atomist/automation-client";
import { BaseAspect, Ideal, idealCoordinates, isConcreteIdeal, supportsEntropy } from "@atomist/sdm-pack-fingerprints";
import { Express, RequestHandler } from "express";
import * as _ from "lodash";
import { AspectFingerprintsForDisplay, FingerprintForDisplay, OrgExplorer } from "../../../views/org";
import { renderStaticReactNode } from "../../../views/topLevelPage";
import {
    FingerprintUsage,
    ProjectAnalysisResultStore,
} from "../../analysis/offline/persist/ProjectAnalysisResultStore";
import { AspectRegistry, ManagedAspect } from "../../aspect/AspectRegistry";
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

            res.send(renderStaticReactNode(OrgExplorer({
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
            })));
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
