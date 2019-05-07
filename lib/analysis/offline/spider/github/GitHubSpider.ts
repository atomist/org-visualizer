import {
    GitCommandGitProject,
    logger,
} from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/lib/operations/common/GitHubRepoRef";
import {
    Interpretation,
    ProjectAnalysis,
    ProjectAnalyzer,
} from "@atomist/sdm-pack-analysis";
import * as Octokit from "@octokit/rest";
import { SpideredRepo } from "../../SpideredRepo";
import { ScmSearchCriteria } from "../ScmSearchCriteria";
import {
    Spider,
    SpiderOptions,
} from "../Spider";

/**
 * Spider GitHub. Ensure that GITHUB_TOKEN environment variable is set.
 */
export class GitHubSpider implements Spider {

    public async spider(criteria: ScmSearchCriteria,
                        analyzer: ProjectAnalyzer,
                        opts: SpiderOptions): Promise<number> {
        const it = queryByCriteria(process.env.GITHUB_TOKEN, criteria);

        let bucket: Array<Promise<any>> = [];
        let count = 0;

        for await (const sourceData of it) {
            ++count;
            const repo = {
                owner: sourceData.owner.login,
                repo: sourceData.name,
                url: sourceData.url,
            };
            const found = await opts.persister.load(repo);
            if (found && await opts.keepExistingPersisted(found)) {
                logger.info("Found valid record for " + JSON.stringify(repo));
            } else {
                logger.info("Performing fresh analysis of " + JSON.stringify(repo));
                try {
                    bucket.push(analyzeAndPersist(sourceData, criteria, analyzer, opts));
                    if (bucket.length === opts.poolSize) {
                        // Run all promises together. Effectively promise pooling
                        await Promise.all(bucket);
                        bucket = [];
                    }
                } catch (err) {
                    logger.error("Failure analyzing repo at %s: %s", sourceData, err.message);
                }
            }
        }
        return count;
    }

}

/**
 * Future for doing the work
 * @return {Promise<void>}
 */
async function analyzeAndPersist(sourceData: any,
                                 criteria: ScmSearchCriteria,
                                 analyzer: ProjectAnalyzer,
                                 opts: SpiderOptions): Promise<void> {
    const enriched = await enrich(sourceData, analyzer, criteria);
    if (!!enriched && (!criteria.interpretationTest || criteria.interpretationTest(enriched.interpretation))) {
        const toPersist: SpideredRepo = {
            analysis: {
                // Use a spread as url has a getter and otherwise disappears
                ...enriched.analysis,
                id: {
                    ...enriched.analysis.id,
                    url: sourceData.html_url,
                },
            },
            topics: [], // enriched.interpretation.keywords,
            sourceData,
            timestamp: sourceData.timestamp,
            query: sourceData.query,
            readme: enriched.readme,
        };
        await opts.persister.persist(toPersist);
        if (opts.onPersisted) {
            try {
                await opts.onPersisted(toPersist);
            } catch (err) {
                logger.warn("Failed to action after persist repo %j: %s",
                    toPersist.analysis.id, err.message);
            }
        }
    }
}

interface Enriched {
    readme: string;
    totalFileCount: number;
    interpretation: Interpretation;
    analysis: ProjectAnalysis;
}

async function enrich(r: any, analyzer: ProjectAnalyzer, criteria: ScmSearchCriteria): Promise<Enriched | undefined> {
    const project = await GitCommandGitProject.cloned(
        process.env.GITHUB_TOKEN ? { token: process.env.GITHUB_TOKEN } : undefined,
        GitHubRepoRef.from({ owner: r.owner.login, repo: r.name }), {
            alwaysDeep: false,
            depth: 1,
        });
    if (criteria.projectTest && !await criteria.projectTest(project)) {
        logger.info("Skipping analysis of %s as it doesn't pass projectTest", project.id.url);
        return undefined;
    }
    const readmeFile = await project.getFile("README.md");
    const readme = !!readmeFile ? await readmeFile.getContent() : undefined;
    const totalFileCount = await project.totalFileCount();

    // When we get there
    // const interpretation = await analyzer.interpret(project, undefined, { full: false});
    const analysis = await analyzer.analyze(project, undefined, { full: true });
    const interpretation = await analyzer.interpret(analysis, undefined);

    return {
        readme,
        totalFileCount,
        interpretation,
        analysis,
    };
}

async function* queryByCriteria(token: string, criteria: ScmSearchCriteria): AsyncIterable<any> {
    const octokit = new Octokit();
    octokit.authenticate({
        type: "token",
        token,
    });
    let results: any[] = [];
    let retrieved = 0;
    for (const q of criteria.githubQueries) {
        logger.info("Running query " + q + "...");
        const options = octokit.search.repos.endpoint.merge({ q });
        for await (const response of octokit.paginate.iterator(options)) {
            retrieved += response.data.items.length;
            const newResults = response.data.items
                .filter((r: any) => !results.some(existing => existing.full_name === r.full_name));
            newResults.forEach((r: any) => {
                r.query = q;
                r.timestamp = new Date();
            });
            for (const newResult of newResults) {
                yield newResult;
            }
            logger.info(`Looked at ${retrieved} repos of max ${criteria.maxRetrieved}...`);
            if (retrieved > criteria.maxRetrieved) {
                break;
            }
            if (results.length > criteria.maxReturned) {
                results = results.slice(0, criteria.maxReturned);
                break;
            }
        }
    }
}
