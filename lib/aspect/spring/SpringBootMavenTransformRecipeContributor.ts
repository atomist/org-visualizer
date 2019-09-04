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

import { Project } from "@atomist/automation-client";
import {
    NamedParameter,
    SdmContext,
} from "@atomist/sdm";
import {
    ProjectAnalysis,
    TransformRecipe,
    TransformRecipeContributor,
} from "@atomist/sdm-pack-analysis";
import {
    HasSpringBootPom,
    SpringProjectCreationParameterDefinitions,
    TransformMavenSpringBootSeedToCustomProject,
} from "@atomist/sdm-pack-spring";

/**
 * Add transform for pom.xml identification
 */
export class SpringBootMavenTransformRecipeContributor implements TransformRecipeContributor {

    public async analyze(p: Project, analysis: ProjectAnalysis, sdmContext: SdmContext): Promise<TransformRecipe | undefined> {
        const parameters: NamedParameter[] = [];
        const isBoot = await HasSpringBootPom.predicate(p);
        if (!isBoot) {
            return undefined;
        }
        for (const name of Object.getOwnPropertyNames(SpringProjectCreationParameterDefinitions)) {
            parameters.push({ name, ...(SpringProjectCreationParameterDefinitions as any)[name] });
        }
        return {
            parameters,
            transforms: [
                ...TransformMavenSpringBootSeedToCustomProject,
            ],
        };
    }

}
