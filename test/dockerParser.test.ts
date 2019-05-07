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

import {
    astUtils,
    InMemoryProject,
    InMemoryProjectFile,
} from "@atomist/automation-client";
import { DockerFileParser } from "@atomist/sdm-pack-docker";

describe("docker parser", () => {

    it("finds port", async () => {
        const file = new InMemoryProjectFile("Dockerfile", df);
        const images = await astUtils.findValues(InMemoryProject.of(file), DockerFileParser, "Dockerfile",
            "//EXPOSE");
        // console.log(JSON.stringify(images));
    });

});

const df = `FROM ubuntu:18.04

LABEL maintainer="Atomist <docker@atomist.com>"

RUN apt-get update && apt-get install -y \\
        dumb-init \\
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/app

WORKDIR /opt/app

EXPOSE 2866

ENV BLUEBIRD_WARNINGS 0
ENV NODE_ENV production
ENV NPM_CONFIG_LOGLEVEL warn
ENV SUPPRESS_NO_CONFIG_WARNING true

ENTRYPOINT ["dumb-init", "node", "--trace-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=384"]

CMD ["/opt/app/node_modules/.bin/atm-start"]

RUN apt-get update && apt-get install -y \\
        build-essential \\
        curl \\
        git \\
    && rm -rf /var/lib/apt/lists/*

RUN git config --global user.email "bot@atomist.com" \\
    && git config --global user.name "Atomist Bot"

RUN curl -sL https://deb.nodesource.com/setup_11.x | bash - \\
    && apt-get install -y nodejs \\
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci \\
    && npm cache clean --force

COPY . .

# Remove before running in production
ENV ATOMIST_ENV development
`;
