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

import { logger } from "@atomist/automation-client";
import { writeUserConfig } from "@atomist/automation-client/lib/configuration";
import { execPromise } from "@atomist/automation-client/lib/util/child_process";
import { ConfigurationPreProcessor } from "@atomist/sdm-core/lib/machine/configure";

export const startEmbeddedPostgres: ConfigurationPreProcessor = async cfg => {
    // start up embedded postgres if needed
    if (process.env.ATOMIST_POSTGRES === "start" && !_.get(cfg, "sdm.postgres")) {
        logger.debug("Starting embedded Postgres");
        await execPromise("/etc/init.d/postgresql", ["start"]);

        const postgresCfg = {
            user: "org_viz",
            password: "atomist",
        };
        _.set(cfg, "sdm.postgres", postgresCfg);
        await writeUserConfig({
            sdm: {
                postgres: postgresCfg,
            },
        });
    }
    return cfg;
};
