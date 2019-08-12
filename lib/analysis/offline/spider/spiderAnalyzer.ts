import { Analyzer } from "./Spider";
import { Aspect, AtomicAspect, FP, isAtomicAspect } from "@atomist/sdm-pack-fingerprints";
import { logger, Project, RemoteRepoRef } from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import { time } from "../../../util/showTiming";
import { ManagedAspect } from "../../../aspect/AspectRegistry";

export function spiderAnalyzer(aspects: ManagedAspect[]): Analyzer {
    return async p => {
        const fingerprints: FP[] = [];
        await Promise.all(aspects
            .filter(f => !isAtomicAspect(f))
            // TODO why is this needed?
            .map(aspect => extractify(aspect as any, p)
                .then(fps =>
                    fingerprints.push(...fps),
                )));

        await Promise.all(aspects
            .filter(isAtomicAspect)
            .map(aspect => extractAtomic(aspect, fingerprints)
                .then(fps =>
                    fingerprints.push(...fps),
                )));

        return {
            id: p.id as RemoteRepoRef,
            fingerprints,
        }
    };
}

async function extractify(aspect: Aspect, p: Project): Promise<FP[]> {
    try {
        const timed = await time(
            async () => await aspect.extract(p));
        if (timed.millis > 500) {
            logger.info("Slow extraction of aspect %s on project %s: took %s millis",
                aspect.name, p.id.url, timed.millis);
        }
        const result = !!timed.result ? toArray(timed.result) : [];
        return result;
    } catch (err) {
        logger.error("Please check your configuration of aspect %s.\n%s",
            aspect.name, err);
        return [];
    }
}

async function extractAtomic(aspect: AtomicAspect, existingFingerprints: FP[]): Promise<FP[]> {
    try {
        const extracted = await aspect.consolidate(existingFingerprints);
        return !!extracted ? toArray(extracted) : [];
    } catch (err) {
        logger.error("Please check your configuration of aspect %s.\n%s",
            aspect.name, err);
        return [];
    }
}