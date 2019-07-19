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

import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import { FP } from "@atomist/sdm-pack-fingerprints";
import * as _ from "lodash";
import {
    AspectRegistry,
    HasFingerprints,
    IdealStore,
    ManagedAspect,
    UndesirableUsage,
    UndesirableUsageChecker,
} from "./AspectRegistry";

export function allFingerprints(ar: HasFingerprints | HasFingerprints[]): FP[] {
    return _.flatMap(toArray(ar), a => a.fingerprints);
}

export async function* fingerprintsFrom(ar: HasFingerprints[] | AsyncIterable<HasFingerprints>): AsyncIterable<FP> {
    for await (const hf of ar) {
        for (const fp of hf.fingerprints) {
            yield fp;
        }
    }
}

/**
 * Aspects must have unique names
 */
export class DefaultAspectRegistry implements AspectRegistry {

    get aspects(): ManagedAspect[] {
        return this.opts.aspects;
    }

    public aspectOf(type: string): ManagedAspect | undefined {
        return type ? this.aspects.find(f => f.name === type) : undefined;
    }

    public get undesirableUsageChecker(): UndesirableUsageChecker {
        return this.opts.undesirableUsageChecker;
    }

    public async findUndesirableUsages(workspaceId: string, hf: HasFingerprints): Promise<UndesirableUsage[]> {
        return _.flatten(await Promise.all(allFingerprints(hf).map(fp =>
            this.undesirableUsageChecker.check(workspaceId, fp))));
    }

    get idealStore(): IdealStore {
        return this.opts.idealStore;
    }

    constructor(private readonly opts: {
        idealStore: IdealStore,
        aspects: ManagedAspect[],
        undesirableUsageChecker: UndesirableUsageChecker,
    }) {
        opts.aspects.forEach(f => {
            if (!f) {
                throw new Error("A null aspect was passed in");
            }
        });
    }
}

export function defaultedToDisplayableFingerprintName(aspect?: ManagedAspect): (fingerprintName: string) => string {
    return (aspect && aspect.toDisplayableFingerprintName) || (name => name);
}

export function defaultedToDisplayableFingerprint(aspect?: ManagedAspect): (fpi: FP) => string {
    return (aspect && aspect.toDisplayableFingerprint) || (fp => fp && fp.data);
}
