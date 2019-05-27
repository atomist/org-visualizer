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

import * as _ from "lodash";
import { defaultedToDisplayableFingerprintName } from "../DefaultFeatureManager";
import {
    ManagedFingerprint,
    ManagedFingerprints,
} from "../FeatureManager";

export function relevantFingerprints(mfs: ManagedFingerprints,
                                     test: (mf: ManagedFingerprint) => boolean): ManagedFingerprints {
    const clone: ManagedFingerprints = _.cloneDeep(mfs);
    for (const featureAndFingerprints of clone.features) {
        featureAndFingerprints.fingerprints = featureAndFingerprints.fingerprints.filter(test);
    }
    clone.features = clone.features.filter(f => f.fingerprints.length > 0);
    return clone;
}

export function allManagedFingerprints(mfs: ManagedFingerprints): ManagedFingerprint[] {
    return _.uniqBy(_.flatMap(mfs.features, f => f.fingerprints), mf => mf.name);
}
