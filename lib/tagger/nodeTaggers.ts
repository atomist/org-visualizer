import { Tagger } from "../aspect/AspectRegistry";
import { NpmDeps } from "@atomist/sdm-pack-fingerprints";
import { TypeScriptVersion } from "../aspect/node/TypeScriptVersion";
import { TsLintType } from "../aspect/node/TsLintAspect";

export const Node = {
    name: "node",
    description: "Node",
    test: fp => fp.type === NpmDeps.name,
};

export const TypeScript = {
    name: "typescript",
    description: "TypeScript version",
    test: fp => fp.type === TypeScriptVersion.name
};

export const TsLint = {
    name: "tslint",
    description: "tslint (TypeScript)",
    test: fp => fp.type === TsLintType
};

export function usesNodeLibrary(opts: {
    library: string,
    version?: string,
    name?: string,
}): Tagger {
    return usesNodeLibraryWhen({
        name: opts.name || opts.library,
        test: (lib, version) => lib === opts.library &&
            (opts.version ? version === opts.version : true),
        description: `Uses node library ${opts.library}`
    });
}

export function usesNodeLibraryWhen(opts: {
    test: (lib: string, version: string) => boolean,
    name: string,
    description: string,
}): Tagger {
    return {
        name: opts.name,
        description: opts.description,
        test: fp => fp.type === NpmDeps.name && opts.test(fp.data[0], fp.data[1]),
    };
}

