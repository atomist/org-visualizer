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

import { AbstractFingerprint, } from "@atomist/sdm";
import { InferredFeature, ProjectAnalysis } from "@atomist/sdm-pack-analysis";
import { RelevanceTest } from "@atomist/sdm-pack-analysis/lib/analysis/TechnologyScanner";
import { DockerStack } from "@atomist/uhura/lib/element/docker/dockerScanner";

import * as _ from "lodash";

/**
 * Represents a version of a particular library
 */
export class DockerBaseImage extends AbstractFingerprint {

    constructor(public readonly base: string) {
        super("docker-base-image", "dbi", "1.0.0", base);
    }
}

export class DockerBaseImageFeature implements InferredFeature<DockerStack, DockerBaseImage> {

    public readonly name = "docker-base-image";

    public get apply() {
        return async (p, t) => {
            throw new Error(`Applying Docker library version ${t.libVersion} not yet supported`);
        }
    };

    public consequence(a: ProjectAnalysis) {
       const s = _.get(a, "elements.docker.dockerFile.parsed.image");
       return s ? new DockerBaseImage(s) : undefined;
    }

    get relevanceTest(): RelevanceTest {
        return pa => !!pa.elements.node;
    }

    // public flag(h: NodeLibraryVersion): WarningFlag {
    //     for (const flag of this.flags) {
    //         const f = flag(h);
    //         if (!!f) {
    //             return f;
    //         }
    //     }
    //     return undefined;
    // }

    public toDisplayableString(h: DockerBaseImage): string {
        return h.base;
    }

}