import { TechnologyElement, TechnologyScanner } from "@atomist/sdm-pack-analysis";
import { Project } from "@atomist/automation-client";

export interface CodeOfConduct extends TechnologyElement {

    /**
     * Content of the code of conduct
     */
    content: string;

    /**
     * Title inferred from the code of conduct, if it was possible to do so
     */
    title?: string;
}

/**
 * Find a code of conduct in a repository if possible
 * @constructor
 */
export const CodeOfConductScanner: TechnologyScanner<CodeOfConduct> =
    async (p: Project) => {
        const codeOfConductFile = await p.getFile("CODE_OF_CONDUCT.md");
        if (codeOfConductFile) {
            const content = await codeOfConductFile.getContent();
            return {
                name: "codeOfConduct",
                tags: ["community"],
                title: titleOf(content),
                content,
            }
        }
        return undefined;
    };

const markdownTitleRegex = /^# (.*)\n/;

/**
 * Try to extract the title from this markdown document
 * @param {string} mdString
 * @return {string | undefined}
 */
function titleOf(mdString: string): string | undefined {
    const match = markdownTitleRegex.exec(mdString);
    return (match && match.length == 2) ?
        match[1] :
        undefined;
}