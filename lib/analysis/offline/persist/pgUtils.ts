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
import { Client } from "pg";

export type ClientFactory = () => Client;

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
 * @return {Promise<R>}
 */
export async function doWithClient<R>(clientFactory: () => Client,
                                      what: (c: Client) => Promise<R>,
                                      defaultResult?: R): Promise<R> {
    const client = clientFactory();
    let result: R;
    try {
        await client.connect();
    } catch (err) {
        throw new Error("Could not connect to Postgres. Please start it up. Message: " + err.message);
    }
    try {
        result = await what(client);
    } catch (err) {
        logger.warn("Error accessing database: ", err);
        return defaultResult;
    } finally {
        await client.end();
    }
    return result;
}
