import { projectUtils } from "@atomist/automation-client";
import { Aspect, FP, sha256 } from "@atomist/sdm-pack-fingerprint";
interface PythonVersionData {
    version: "2" | "3" | "indeterminate";
}

const PythonVersionAspectName = "PythonVersion";

export const PythonVersion: Aspect<PythonVersionData> = {
    name: PythonVersionAspectName,
    displayName: "Python 2 or 3",
    extract: async p => {

        const hasPython: boolean = await projectUtils.fileExists(p, "**/*.py");
        if (!hasPython) {
            return undefined;
        }

        const data: PythonVersionData = { version: "indeterminate" };
        return fingerprintOf({
            type: PythonVersionAspectName,
            name: "Python2or3",
            data,
        });
    },
};

// rod: promote this to fingerprint pack? I added uniquePartOfData
function fingerprintOf<DATA = any>(opts: {
    type: string,
    name?: string,
    data: DATA,
    uniquePartOfData?: (d: DATA) => Partial<DATA>,
}): FP<DATA> {
    const dataToSha = opts.uniquePartOfData ? opts.uniquePartOfData(opts.data) : opts.data;
    return {
        type: opts.type,
        name: opts.name || opts.type,
        data: opts.data,
        sha: sha256(JSON.stringify(dataToSha)),
    };
}
