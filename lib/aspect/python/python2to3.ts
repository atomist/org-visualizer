import { Aspect, fingerprintOf, FP } from "@atomist/sdm-pack-fingerprint";
interface PythonVersionData {
    version: "2" | "3" | "indeterminate";
}

const PythonVersionAspectName = "PythonVersion";

export const PythonVersion: Aspect<PythonVersionData> = {
    name: PythonVersionAspectName,
    displayName: "Python 2 or 3",
    extract: async p => {

        const data: PythonVersionData = { version: "indeterminate" };
        return fingerprintOf({
            type: PythonVersionAspectName,
            name: "Python2or3",
            data,
        });
    },
};
