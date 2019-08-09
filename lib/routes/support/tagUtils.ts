import * as _ from "lodash";
import { ProjectAnalysisResult } from "../../analysis/ProjectAnalysisResult";
import { AspectRegistry, Tag, tagsIn } from "../../aspect/AspectRegistry";
import { TagUsage } from "../../tree/sunburst";
import { TagContext } from "../api";

export type TaggedRepo = ProjectAnalysisResult & { tags: Tag[] };

export function tagRepos(aspectRegistry: AspectRegistry,
                         tagContext: TagContext,
                         repos: ProjectAnalysisResult[]): TaggedRepo[] {
    return repos.map(repo => tagRepo(aspectRegistry, tagContext, repo));
}

export function tagRepo(aspectRegistry: AspectRegistry,
                        tagContext: TagContext,
                        repo: ProjectAnalysisResult): TaggedRepo {
    return {
        ...repo,
        tags: tagsIn(aspectRegistry, repo.analysis.fingerprints, tagContext)
            .concat(aspectRegistry.combinationTagsFor(repo.analysis.fingerprints, tagContext)),
    };
}

export function tagUsageIn(aspectRegistry: AspectRegistry, relevantRepos: Array<ProjectAnalysisResult & { tags: Tag[] }>): TagUsage[] {
    const relevantTags = _.groupBy(_.flatten(relevantRepos.map(r => r.tags.map(tag => tag.name))));
    return Object.getOwnPropertyNames(relevantTags).map(name => ({
        name,
        description: aspectRegistry.availableTags.find(t => t.name === name).description,
        severity: aspectRegistry.availableTags.find(t => t.name === name).severity,
        count: relevantTags[name].length,
    }));
}
