import { isCodeMetricsFingerprint } from "../aspect/common/codeMetrics";
import { CodeOfConductType } from "../aspect/community/codeOfConduct";
import { hasNoLicense, isLicenseFingerprint } from "../aspect/community/license";
import { isGlobMatchFingerprint } from "../aspect/compose/globAspect";
import { CombinationTagger, Tagger } from "../aspect/DefaultAspectRegistry";
import { BranchCountType } from "../aspect/git/branchCount";
import { daysSince } from "../aspect/git/dateUtils";
import { GitActivesType, GitRecencyType } from "../aspect/git/gitActivity";
import { ExposedSecrets } from "../aspect/secret/exposedSecrets";

export const Monorepo: Tagger = {
    name: "monorepo",
    description: "Contains multiple virtual projects",
    severity: "warn",
    test: fp => !!fp.path && fp.path.length > 0,
};

export const Vulnerable: Tagger = {
    name: "vulnerable",
    description: "Has exposed secrets", test: fp => fp.type === ExposedSecrets.name,
    severity: "error",
};

export const HasLicense: Tagger = {
    name: "license",
    description: "Repositories should have a license",
    test: fp => isLicenseFingerprint(fp) && !hasNoLicense(fp.data),
};

export const HasCodeOfConduct: Tagger = {
    name: "code-of-conduct",
    description: "Repositories should have a code of conduct",
    test: fp => fp.type === CodeOfConductType,
};

/**
 * Tag projects as dead if they haven't been committed to recently
 * @param {{days: number}} opts number of days at which to conclude a project is dead
 * @return {Tagger}
 */
export function dead(opts: { deadDays: number }): Tagger {
    return {
        name: "dead?",
        description: `No git activity in last ${opts.deadDays} days`,
        severity: "error",
        test: fp => {
            if (fp.type === GitRecencyType) {
                const date = new Date(fp.data);
                return daysSince(date) > opts.deadDays;
            }
            return false;
        },
    };
}

export const SoleCommitter: Tagger = {
    name: "sole-committer",
    description: "Projects with one committer",
    test: fp => fp.type === GitActivesType && fp.data.count === 1,
};

export function excessiveBranchCount(opts: { maxBranches: number }): Tagger {
    return {
        name: `>${opts.maxBranches} branches`,
        description: "git branch count",
        severity: "warn",
        test: fp => fp.type === BranchCountType && fp.data.count > opts.maxBranches,
    };
}

export function lineCountTest(opts: { name: string, lineCountTest: (lineCount: number) => boolean }): Tagger {
    return {
        name: opts.name,
        description: "Repo size",
        test: fp => isCodeMetricsFingerprint(fp) && opts.lineCountTest(fp.data.lines),
    };
}

export function globRequired(opts: { name: string, description: string, glob: string }): Tagger {
    return {
        ...opts,
        test: fp => isGlobMatchFingerprint(fp) && fp.data.glob === opts.glob && fp.data.matches.length > 0,
    };
}

export function gitHot(opts: { name?: string, hotDays: number, hotContributors: number }): CombinationTagger {
    return {
        name: opts.name || "hot",
        description: "How hot is git",
        test: fps => {
            const grt = fps.find(fp => fp.type === GitRecencyType);
            const acc = fps.find(fp => fp.type === GitActivesType);
            if (!!grt && !!acc) {
                const days = daysSince(new Date(grt.data));
                if (days < opts.hotDays && acc.data.count > opts.hotContributors) {
                    return true;
                }
            }
            return false;
        },
    };
}
