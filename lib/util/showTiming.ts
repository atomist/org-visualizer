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
