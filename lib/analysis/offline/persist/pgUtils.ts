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

import { Client } from "pg";
import { logger } from "@atomist/automation-client";

export type ClientFactory = () => Client;

/**
 * Perform the given operations with a database client connection
 * @param {() => } clientFactory
 * @param {(c: ) => Promise<R>} what
 * @return {Promise<R>}
 */
export async function doWithClient<R>(clientFactory: () => Client,
                                      what: (c: Client) => Promise<R>): Promise<R> {
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
        logger.warn(err);
    } finally {
        client.end();
    }
    return result;
}
