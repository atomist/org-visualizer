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

import { AbstractFingerprint } from "@atomist/sdm";
import { Aspect } from "@atomist/sdm-pack-fingerprints";
import { ExtractFingerprint } from "@atomist/sdm-pack-fingerprints/lib/machine/Aspect";
import * as _ from "lodash";
import { Error } from "tslint/lib/error";

const TsLintAspectName = "tslint";

export class TsLintProperty extends AbstractFingerprint {

    public readonly type: string = TsLintAspectName;

    constructor(public readonly path: string, public readonly property: string, data: any) {
        super(`${path}:${property}`, "tsp", "1.0.0", JSON.stringify(data));
    }

}

export class TsLintPropertyAspect implements Aspect<TsLintProperty> {

    public readonly displayName: string = "TSLint";

    public readonly name: string = TsLintAspectName;

    get apply() {
        return async (p, tsi) => {
            throw new Error(`Applying TSlint version ${tsi.typeScriptVersion} not yet supported`);
        };
    }

    public extract: ExtractFingerprint<TsLintProperty> = async p => {
        const tslint = await p.getFile("tslint.json");
        if (!tslint) {
            return undefined;
        }
        const content = await tslint.getContent();
        const json = JSON.parse(content);
        const pathObj = _.get(json, this.path, {});
        return Object.getOwnPropertyNames(pathObj)
            .map(property => {
                return new TsLintProperty(
                    this.path,
                    property,
                    pathObj[property] || "");
            });
    }

    constructor(public readonly path: string = "rules") {
    }

}
