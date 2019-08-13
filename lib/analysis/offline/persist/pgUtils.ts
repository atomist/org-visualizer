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
import {
    PoolClient,
} from "pg";

export type ClientFactory = () => Promise<PoolClient>;

/**
 * Perform the given operations with a database client connection
 *
 * Connection errors result in an exception.
 * Errors thrown by the passed-in function result are logged, and the
 * provided defaultResult is returned (or else undefined).
 *
 * @param {() => } clientFactory factory for clients
 * @param {(c: ) => Promise<R>} what a function to run with the client
 * @param {R} defaultResult return this in case of error. If not provided, return undefined
 * @param description description of what we're doing. Allows for timing
 * @return {Promise<R>}
 */
export async function doWithClient<R>(description: string,
                                      clientFactory: ClientFactory,
                                      what: (c: PoolClient) => Promise<R>,
                                      defaultResult?: R | ((e: Error) => R)): Promise<R> {
    const startTime = new Date().getTime();
    const client = await clientFactory();
    let result: R;
    try {
        result = await what(client);
    } catch (err) {
        logger.warn("Error accessing database: ", err);
        if (typeof defaultResult === "function") {
            // if you really want a default value that is a function,
            // then pass a function of error that returns that function, please.
            return (defaultResult as (e: Error) => R)(err);
        }
        return defaultResult;
    } finally {
        client.release();
        const endTime = new Date().getTime();
        logger.debug("============= RDBMS operation ==================\n%s\n>>> Executed in %d milliseconds",
            description, endTime - startTime);
    }
    return result;
}
