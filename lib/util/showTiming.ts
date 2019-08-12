import { logger } from "@atomist/automation-client";

/**
 * Log the timing of this function
 * @param {string} description
 * @param {() => Promise<T>} what
 * @return {Promise<T>}
 */
export async function showTiming<T>(description: string,
                                    what: () => Promise<T>): Promise<T> {
    const startTime = new Date().getTime();
    try {
        const result = await what();
        return result;
    } finally {
        const endTime = new Date().getTime();
        logger.info("Performed '%s' in %d milliseconds",
            description, endTime - startTime);
    }
}