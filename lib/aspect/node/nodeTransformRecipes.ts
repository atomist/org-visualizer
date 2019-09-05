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
import { NamedParameter } from "@atomist/sdm";
import {
    TransformRecipe,
    TransformRecipeContributionRegistration,
    TransformRecipeContributor,
} from "@atomist/sdm-pack-analysis";
import { NodeProjectCreationParametersDefinition, UpdatePackageJsonIdentification } from "@atomist/sdm-pack-node";

/**
 * Add transform for package.json identification.
 * Depends on Node pack.
 */
const contributor: TransformRecipeContributor = {

    analyze: async (p: Project): Promise<TransformRecipe | undefined> => {
        if (!await p.hasFile("package.json")) {
            return undefined;
        }
        const parameters: NamedParameter[] = [];
        for (const name of Object.getOwnPropertyNames(NodeProjectCreationParametersDefinition)) {
            parameters.push({ name, ...(NodeProjectCreationParametersDefinition as any)[name] });
        }
        return {
            parameters,
            transforms: [
                UpdatePackageJsonIdentification,
            ],
        };
    },

};

export const PackageJsonTransformRecipe: TransformRecipeContributionRegistration = {
    originator: "node",
    optional: false,
    contributor,
};
