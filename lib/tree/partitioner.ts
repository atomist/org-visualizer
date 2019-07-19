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

import { Analyzed } from "../aspect/AspectRegistry";

export interface Term {
    name: string;
    predicate: (pas: Analyzed) => boolean;
}

export interface Terms {
    terms: Term[];
}

export interface Partition {
    term: Term;
    matching: number;
    total: number;
}

export function suggestPartitions(repos: Analyzed[], terms: Terms): Partition[] {
    const partitions: Partition[] = [];
    for (const term of terms.terms) {
        const matching = repos.filter(term.predicate).length;
        partitions.push({
            term,
            matching,
            total: repos.length,
        });
    }

    function rate(partition: Partition): number {
        return Math.abs(partition.matching - partition.total / 2);
    }

    return partitions.sort((a, b) => rate(b) - rate(a));
}
