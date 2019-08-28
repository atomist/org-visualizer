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

import { ScoreWeightings } from "@atomist/sdm-pack-aspect";
import {
    PushScorer,
    scoredAspect,
    ScoredAspect,
} from "../score/scoredAspect";

/**
 * Calculate the risk of this compute with the given scorers, which should return a
 * score from 1 (low) to 5 (high).
 */
export function commitRisk(opts: {
    scorers: PushScorer[],
    scoreWeightings?: ScoreWeightings,
}): ScoredAspect {
    return scoredAspect({
        ...opts,
        name: "commit-risk",
        displayName: "commit-risk",
        toDisplayableFingerprint: fp => "Risk: " + fp.data.score,
    });
}
