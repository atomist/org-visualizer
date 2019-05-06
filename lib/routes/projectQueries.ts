import { ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { CodeStats } from "@atomist/sdm-pack-sloc/lib/slocReport";
import { CodeMetricsElement } from "../element/codeMetricsElement";
import { SunburstTreeEmitter, treeBuilder } from "../tree/TreeBuilder";

/**
 * Languages used in this project
 * @type {SunburstTreeEmitter}
 */
export const languagesQuery: SunburstTreeEmitter<ProjectAnalysis> =
    treeBuilder<ProjectAnalysis>("by language")
        .split<CodeStats>({
            namer: ar => ar.id.repo,
            splitter: ar => {
                const cme = ar.elements.codemetrics as CodeMetricsElement;
                return cme.languages;
            },
        })
        .renderWith(codeStats => {
            return {
                name: `${codeStats.language.name} (${codeStats.total})`,
                size: codeStats.total,
            };
        });
