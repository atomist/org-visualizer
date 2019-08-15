import { Aspect, filesAspect } from "@atomist/sdm-pack-fingerprints";
import { conditionalize } from "../compose/conditionalize";

export const NodeGitIgnore: Aspect =
    conditionalize(filesAspect({
            name: "node-gitignore",
            displayName: "Node git ignore",
            type: "node-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
        ),
        async p => p.hasFile("package.json"));

export const JavaGitIgnore: Aspect =
    conditionalize(filesAspect({
            name: "spring-gitignore",
            displayName: "git ignore",
            type: "spring-gitignore",
            toDisplayableFingerprint: fp => fp.sha,
            canonicalize: c => c,
        }, ".gitignore",
        ),
        async p => p.hasFile("pom.xml"));
