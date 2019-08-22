import { logger } from "@atomist/automation-client";
import { writeUserConfig } from "@atomist/automation-client/lib/configuration";
import { execPromise } from "@atomist/automation-client/lib/util/child_process";
import { ConfigurationPreProcessor } from "@atomist/sdm-core/lib/machine/configure";

export const startEmbeddedPostgres: ConfigurationPreProcessor = async cfg => {
    // start up embedded postgres if needed
    if (process.env.ATOMIST_POSTGRES === "start" && !_.get(cfg, "sdm.postgres")) {
        logger.debug("Starting embedded Postgres");
        await execPromise("/etc/init.d/postgresql", ["start"]);

        const postgresCfg = {
            user: "org_viz",
            password: "atomist",
        };
        _.set(cfg, "sdm.postgres", postgresCfg);
        await writeUserConfig({
            sdm: {
                postgres: postgresCfg,
            },
        });
    }
    return cfg;
}
