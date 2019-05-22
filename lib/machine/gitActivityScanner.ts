import { TechnologyElement, TechnologyScanner } from "@atomist/sdm-pack-analysis";
import { spawnPromise } from "@atomist/sdm";
import * as util from "util";

const exec = util.promisify(require('child_process').exec);

export interface GitActivity extends TechnologyElement {

    name: "gitActivity";
    last7: number;
}

export const GitActivityScanner: TechnologyScanner<GitActivity> =
    async p => {
    // TODO make this reusable so we can see for default branch and all others
        const r = await exec(sinceDays(7), { cwd: (p as any).baseDir });
        if (!r.stdout) {
            return undefined;
        }
        const last7 = parseInt(r.stdout.trim());

        return {
            tags: ["git"],
            name: "gitActivity",
            last7,
        }
    };

function sinceDays(days: number): string {
    return `git log --all --since=${days}.days --pretty=oneline | wc -l`;
}