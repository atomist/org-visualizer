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

import { Configuration } from "@atomist/automation-client";
import {
    ConfigureOptions,
    configureSdm,
} from "@atomist/sdm-core";
import {
    analysisResultStore,
    clientFactory,
    machine,
} from "./lib/machine/machine";
import { allowFraming } from "./lib/routes/allowFraming";
import { orgPage } from "./lib/routes/orgPage";
import { api } from "./lib/routes/api";

const machineOptions: ConfigureOptions = {
    /**
     * When your SDM requires configuration that is unique to it,
     * you can list it here.
     */
    requiredConfigurationValues: [],
};

/**
 * The starting point for building an SDM is here!
 */
export const configuration: Configuration = {
    /**
     * To run in team mode, you'll need an Atomist workspace.
     * To run in local mode, you don't. This will be ignored.
     * See: https://docs.atomist.com/developer/architecture/#connect-your-sdm
     */
    workspaceIds: ["connect this SDM to your whole team with the Atomist service"],
    postProcessors: [
        /**
         * This is important setup! This defines the function that will be called
         * to configure your SDM with everything that you want it to do.
         *
         * Click into the first argument (the "machine" function) to personalize
         * your SDM.
         */
        configureSdm(machine, machineOptions),
        async cfg => {
            cfg.http.customizers = [
                api(clientFactory, analysisResultStore),
                orgPage(analysisResultStore),
                allowFraming("https://blog.atomist.com"),
            ];
            return cfg;
        },
    ],
    http: {
        enabled: true,

    },
};
