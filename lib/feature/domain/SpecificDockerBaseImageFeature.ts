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
import { DockerFileParser } from "@atomist/sdm-pack-docker";
import { astUtils, InMemoryProject, InMemoryProjectFile } from "@atomist/automation-client";

/**
 * Represents a version of a particular library
 */
export class SpecificDockerBaseImage extends AbstractFingerprint {

    constructor(public readonly image: string, public readonly imageVersion: string) {
        super(`docker:${image}`, "sdb", "1.0.0", image + ":" + imageVersion);
    }
}

export class SpecificDockerBaseImageFeature implements InferredFeature<DockerStack, SpecificDockerBaseImage> {

    public readonly name;

    public get apply() {
        return async (p, t) => {
            throw new Error(`Applying Specific docker base image library version ${t.libVersion} not yet supported`);
        }
    };

    public async consequence(analysis: ProjectAnalysis) {
        const docker = analysis.elements.docker as DockerStack;
        if (!docker || !docker.dockerFile) {
            return undefined;
        }
        const file = new InMemoryProjectFile(docker.dockerFile.path, docker.dockerFile.content);
        const images = await astUtils.findValues(InMemoryProject.of(file), DockerFileParser, "**/Dockerfile",
            "//FROM/image");
        if (images.length !== 1) {
            return undefined;
        }
        const [image, version] = images[0].split(/[\:\/]/);
        if (image !== this.image) {
            return undefined;
        }
        return new SpecificDockerBaseImage(image, version);
    }

    get relevanceTest(): RelevanceTest {
        return pa => true;
    }

    public toDisplayableString(h: SpecificDockerBaseImage): string {
        return h.imageVersion;
    }

    constructor(public readonly image: string) {
        this.name = `docker:${image}`;
    }

}