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
