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
} from "@atomist/sdm";
import {
    TransformRecipeContributor,
} from "@atomist/sdm-pack-analysis";
import {
    HasSpringBootPom,
    SpringBootProjectStructure,
    SpringProjectCreationParameterDefinitions,
    TransformMavenSpringBootSeedToCustomProject,
} from "@atomist/sdm-pack-spring";

/**
 * Add transform for pom.xml identification. Requires Spring parameters.
 */
export const SpringBootTransformRecipes: TransformRecipeContributor = {

    analyze: async (p: Project) => {
        const isBoot = await HasSpringBootPom.predicate(p);
        if (!isBoot) {
            return undefined;
        }
        return {
            parameters: requiredSpringParameters(),
            transforms: [
                ...TransformMavenSpringBootSeedToCustomProject,
            ],
        };
    },

};

function requiredSpringParameters(): NamedParameter[] {
    return Object.getOwnPropertyNames(SpringProjectCreationParameterDefinitions).map(name =>
        ({ name, ...(SpringProjectCreationParameterDefinitions as any)[name] }),
    );
}

/**
 * Transform a Spring Boot docker file to new Spring Boot Structure.
 * Requires no parameters as it can see old and new Spring Boot structure.
 * Does nothing if not Docker or Spring Boot.
 */
export const DockerTransformRecipeContributor: TransformRecipeContributor = {

    analyze: async (p: Project) => {
        const oldSpringBootStructure = await SpringBootProjectStructure.inferFromJavaOrKotlinSource(p);
        const dockerFile = await p.getFile("Dockerfile");
        if (!oldSpringBootStructure && !dockerFile) {
            return undefined;
        }

        return {
            parameters: [],
            transforms: [
                async p => {
                    const newSpringBootStructure = await SpringBootProjectStructure.inferFromJavaOrKotlinSource(p);
                    const dockerFile = await p.getFile("Dockerfile");
                    if (!!newSpringBootStructure && !!dockerFile) {
                        await dockerFile.replaceAll(
                            oldSpringBootStructure.applicationPackage + "." + oldSpringBootStructure.applicationClass,
                            newSpringBootStructure.applicationPackage + "." + newSpringBootStructure.applicationClass);
                    }
                },
            ],
        };
    },

};
