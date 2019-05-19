import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";

export interface Term {
    name: string;
    predicate: (pas: ProjectAnalysisResult) => boolean;
}

export interface Terms {
    terms: Term[];
}

export interface Partition {
    term: Term;
    matching: number;
    total: number;
}

export function suggestPartitions(repos: ProjectAnalysisResult[], terms: Terms): Partition[] {
    const partitions: Partition[] = [];
    for (const term of terms.terms) {
        const matching = repos.filter(term.predicate).length;
        partitions.push({
            term,
            matching,
            total: repos.length,
        });
    }

    function rate(partition: Partition) {
        return Math.abs(partition.matching - partition.total / 2);
    }

    return partitions.sort((a, b) => rate(b) - rate(a));
}