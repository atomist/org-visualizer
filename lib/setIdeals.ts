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

import { allFingerprints } from "./feature/DefaultFeatureManager";
import { analysisResultStore } from "./machine/machine";
import {
    featureManager,
    IdealStore,
    retrieveFromStupidLocalStorage,
    saveToStupidLocalStorage,
} from "./routes/features";

import * as _ from "lodash";

async function setIdeals() {
    const repos = await analysisResultStore.loadWhere("");
    const names = _.uniq(allFingerprints(repos.map(r => r.analysis)).map(fp => fp.name));
    const ideals: IdealStore = retrieveFromStupidLocalStorage();
    for (const name of names) {
        if (!ideals[name]) {
            // TODO dirty
            const feature = featureManager.featureFor({ name } as any);
            if (feature && feature.suggestedIdeals) {
                const newIdeals = await feature.suggestedIdeals(name);
                if (newIdeals && newIdeals.length > 0) {
                    ideals[name] = newIdeals[0];
                }
            }
        }
    }
    await saveToStupidLocalStorage(ideals);

}

setIdeals();
