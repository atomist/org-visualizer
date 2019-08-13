import { RepositoryScorer } from "../aspect/AspectRegistry";
import { TsLintType } from "../aspect/node/TsLintAspect";
import { TypeScriptVersionType } from "../aspect/node/TypeScriptVersion";

/**
 * TypeScript projects must use tslint
 * @param {TaggedRepo} repo
 * @return {Promise<any>}
 * @constructor
 */
export const TypeScriptProjectsMustUseTsLint: RepositoryScorer = async repo => {
    const isTs = repo.analysis.fingerprints.find(fp => fp.type === TypeScriptVersionType);
    if (!isTs) {
        return undefined;
    }
    const hasTsLint = repo.analysis.fingerprints.find(fp => fp.type === TsLintType);
    return {
        name: "has-tslint",
        score: hasTsLint ? 5 : 1,
        reason: hasTsLint ? "TypeScript projects should use tslint" : "TypeScript project using tslint",
    };
};
