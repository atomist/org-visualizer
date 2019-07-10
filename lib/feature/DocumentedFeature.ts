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

import { Feature } from "@atomist/sdm-pack-fingerprints";

export interface DocumentedFeature {
    documentationUrl: string;
}

export function isDocumentedFeature(f: Feature): f is Feature & DocumentedFeature {
    const maybe = f as any as DocumentedFeature;
    return !!maybe.documentationUrl;
}
