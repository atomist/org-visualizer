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
    Aspect,
    fingerprintOf,
} from "@atomist/sdm-pack-fingerprint";
import {
    setSpringBootVersionTransform,
    SpringBootVersionInspection,
} from "@atomist/sdm-pack-spring";

const SpringBootVersionType = "spring-boot-version";

export const SpringBootVersion: Aspect = {
    name: SpringBootVersionType,
    displayName: "Spring Boot Version",

    extract: async p => {
        const versions = await SpringBootVersionInspection(p, undefined);
        if (!versions || versions.versions.length === 0) {
            return undefined;
        }
        return fingerprintOf({
            type: SpringBootVersionType,
            data: versions,
        });
    },
    apply: async (p, papi) => {
        const fp = papi.parameters.fp;
        if (fp.data.length !== 1) {
            return p;
        }
        await setSpringBootVersionTransform(fp.data[0])(p, undefined, undefined);
        return p;
    },
    toDisplayableFingerprintName: () => "Spring Boot version",
    toDisplayableFingerprint: fp => fp.data.versions.map(v => v.version).join(","),
};
