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
