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
    Project,
    RemoteRepoRef,
} from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import {
    Aspect,
    AtomicAspect,
    FP,
    isAtomicAspect, VirtualProjectFinder,
} from "@atomist/sdm-pack-fingerprints";
import {
    Analyzed,
    ManagedAspect,
} from "../../../aspect/AspectRegistry";
import { time } from "../../../util/showTiming";
import {
    Analyzer,
    TimeRecorder,
} from "./Spider";

export class SpiderAnalyzer implements Analyzer {

    public readonly timings: TimeRecorder = {};

    public async analyze(p: Project): Promise<Analyzed> {
        const fingerprints: FP[] = [];

        const regularAspects: Aspect[] = this.aspects.filter(a => !isAtomicAspect(a)) as any;
        const atomicAspects = this.aspects.filter(isAtomicAspect);

        if (this.virtualProjectFinder) {
            // Seed the virtual project finder if we have one
            await this.virtualProjectFinder.findVirtualProjectInfo(p);
        }
        await extractRegularAspects(p, regularAspects,
            fingerprints, this.timings);

        await extractAtomicAspects(p, atomicAspects, fingerprints);

        return {
            id: p.id as RemoteRepoRef,
            fingerprints,
        };
    }

    constructor(private readonly aspects: ManagedAspect[],
                private readonly virtualProjectFinder?: VirtualProjectFinder) {

    }
}

async function extractRegularAspects(p: Project,
                                     aspects: Aspect[],
                                     fingerprints: FP[],
                                     timings: TimeRecorder): Promise<void> {
    await Promise.all(aspects
    // TODO why is this cast needed?
        .map(aspect => extractify(aspect as any, p, timings)
            .then(fps =>
                fingerprints.push(...fps),
            )));
}

async function extractAtomicAspects(p: Project,
                                    aspects: AtomicAspect[],
                                    fingerprints: FP[]): Promise<void> {
    await Promise.all(aspects
        .map(aspect => extractAtomic(aspect, fingerprints)
            .then(fps =>
                fingerprints.push(...fps),
            )));
}

async function extractify(aspect: Aspect, p: Project, timeRecorder: TimeRecorder): Promise<FP[]> {
    try {
        const timed = await time(
            async () => aspect.extract(p));
        addTiming(aspect.name, timed.millis, timeRecorder);
        const result = !!timed.result ? toArray(timed.result) : [];
        return result;
    } catch (err) {
        logger.error("Please check your configuration of aspect %s.\n%s",
            aspect.name, err);
        return [];
    }
}

function addTiming(type: string, millis: number, timeRecorder: TimeRecorder): void {
    let found = timeRecorder[type];
    if (!found) {
        found = {
            extractions: 0,
            totalMillis: 0,
        };
        timeRecorder[type] = found;
    }
    found.extractions++;
    found.totalMillis += millis;
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
