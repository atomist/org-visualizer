import {
    TechnologyElement,
    TechnologyScanner,
} from "@atomist/sdm-pack-analysis";
import {
    calculateCodeMetrics,
    CodeMetrics,
} from "@atomist/sdm-pack-sloc";

export interface CodeMetricsElement extends TechnologyElement,
    Pick<CodeMetrics, "languages" | "totalFiles" | "lines" | "files"> {

    name: "codemetrics";

}

/**
 * Scan for lines of code in particular programming languages.
 * Uses @atomist/sdm-pack-sloc
 */
export const codeMetricsScanner: TechnologyScanner<CodeMetricsElement> = async p => {
    const codeMetrics = await calculateCodeMetrics(p);
    const relevantLanguages = codeMetrics.languages.filter(l => l.total > 0);
    const tags = relevantLanguages.map(lr => lr.language.name);
    return {
        name: "codemetrics",
        tags,
        languages: relevantLanguages,
        files: codeMetrics.files,
        lines: codeMetrics.lines,
        totalFiles: codeMetrics.totalFiles,
    };
};
