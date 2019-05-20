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

import { analysisResultStore } from "./machine/machine";
import {
    featureManager,
    IdealStore,
    retrieveFromStupidLocalStorage,
    saveToStupidLocalStorage
} from "./routes/features";
import { allFingerprints } from "./feature/DefaultFeatureManager";

import * as _ from "lodash";

async function setIdeals() {
    const repos = await analysisResultStore.loadAll();
    // const features = await featureManager.managedFingerprints(repos);
    const names = _.uniq(allFingerprints(repos).map(fp => fp.name));
    const ideals: IdealStore = retrieveFromStupidLocalStorage();
    for (const name of names) {
        if (!ideals[name]) {
            // TODO dirty
            const feature = featureManager.featureFor({name} as any);
            if (feature && feature.suggestIdeal) {
                const ideal = await feature.suggestIdeal(name, []);
                if (ideal && ideal.world) {
                    console.log(`Adding ideal ${JSON.stringify(ideal)} for fingerprint name '${name}'`);
                    ideals[name] = ideal.world.ideal;
                }
            }
        }
    }
    await saveToStupidLocalStorage(ideals);

}

setIdeals();