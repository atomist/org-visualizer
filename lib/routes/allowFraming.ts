import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import {
    Express,
    RequestHandler,
} from "express";
import helmet = require("helmet");

export function allowFraming(fromUrl: string): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {
        express.use(helmet.frameguard({
            action: "allow-from",
            domain: fromUrl,
        }));
    };
}
