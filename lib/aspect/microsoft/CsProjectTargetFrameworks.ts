import { microgrammar } from "@atomist/microgrammar";
import {
    Aspect,
    FP,
} from "@atomist/sdm-pack-fingerprints";
import {
    FileMatchData,
    microgrammarMatchAspect,
} from "../compose/fileMatchAspect";

const targetFrameworksGrammar = microgrammar({
    _open: /<TargetFrameworks?>/,
    targetFramework: /[a-zA-Z0-9_;/.]+/,
    _close: /<\/TargetFrameworks?>/,
});

/**
 * TargetFramework
 * @type {Aspect<FP<FileMatchData>>}
 */
export const CsProjectTargetFrameworks: Aspect<FP<FileMatchData>> =
    microgrammarMatchAspect({
        name: "csproject-targetframeworks",
        displayName: "CSProject TargetFrameworks",
        glob: "*.csproj",
        grammar: targetFrameworksGrammar,
        path: "targetFramework",
    });
