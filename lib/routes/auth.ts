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
    Configuration,
    configurationValue,
    logger,
} from "@atomist/automation-client";
import { ApolloGraphClient } from "@atomist/automation-client/lib/graph/ApolloGraphClient";
import { isInLocalMode } from "@atomist/sdm-core";
import { CorsOptions } from "cors";
import * as exp from "express";
import * as _ from "lodash";

const PersonByIdentityQuery = `query PersonByIdentity {
  personByIdentity {
    team {
      id
      name
    }
  }
}
`;

interface PersonByIdentity {
    personByIdentity: Array<{ team: { id: string, name: string } }>;
}

export function configureAuth(express: exp.Express): void {
    const authParser = require("express-auth-parser");
    express.use(authParser);
}

export function corsHandler(): exp.RequestHandler {
    const cors = require("cors");
    const origin = _.get(configurationValue<Configuration>(), "cors.origin", []);
    const corsOptions: CorsOptions = {
        origin,
        credentials: true,
        allowedHeaders: ["x-requested-with", "authorization", "content-type", "credential", "X-XSRF-TOKEN"],
        exposedHeaders: "*",
    };
    return cors(corsOptions);
}

export function authHandlers(): exp.RequestHandler[] {
    // In local mode we don't need auth
    if (isInLocalMode()) {
        return  [(req: exp.Request, res: exp.Response, next: exp.NextFunction) => next()];
    }

    const cookieParser = require("cookie-parser");
    return [cookieParser(), (req: exp.Request, res: exp.Response, next: exp.NextFunction) => {
        let creds: string;
        if (!!req.cookies && !!req.cookies.access_token) {
            creds = req.cookies.access_token;
        } else {
            creds = (req as any).authorization.credentials;
        }

        const workspaceId = req.params.workspace_id || req.query.workspace_id;

        if (!workspaceId) {
            next();
        } else {
            const graphClient = new ApolloGraphClient(
                configurationValue<Configuration>().endpoints.graphql.replace("/team", ""),
                {
                    Authorization: `Bearer ${creds}`,
                });

            graphClient.query<PersonByIdentity, {}>({ query: PersonByIdentityQuery, variables: {} })
                .then(result => {
                    if (result.personByIdentity && result.personByIdentity.some(p => p.team && p.team.id === workspaceId)) {
                        logger.info("Granting access to workspaceId '%s'", workspaceId);
                        next();
                    } else {
                        logger.info("Denying access to workspaceId '%s'", workspaceId);
                        res.sendStatus(401);
                    }
                })
                .catch(err => {
                    logger.warn("Error granting access to workspaceId '%s'", workspaceId);
                    logger.warn(err);
                    res.sendStatus(401);
                });
        }
    }];
}
