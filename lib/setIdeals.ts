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