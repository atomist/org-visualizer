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

import { Scorer } from "@atomist/sdm-pack-analysis";
import { FeatureManager } from "../feature/FeatureManager";

export function idealConvergenceScorer(fm: FeatureManager): Scorer {
    return async i => {
        const allFingerprintNames = Object.getOwnPropertyNames(i.reason.analysis.fingerprints);
        let correctFingerprints = 0;
        let hasIdeal = 0;
        for (const name of allFingerprintNames) {
            // const ideal = await fm.idealResolver.fetchIdeal(name);
            // if (ideal && ideal.ideal) {
            //     ++hasIdeal;
            //     if (ideal.ideal.sha === i.reason.analysis.fingerprints[name].sha) {
            //         ++correctFingerprints;
            //     }
            // }
        }
        const proportion = hasIdeal > 0 ? correctFingerprints / hasIdeal : 1;
        return {
            name: "ideals",
            score: Math.round(proportion * 5) as any,
        };
    };
}
