import { Huckleberry } from "./Huckleberry";
import { Interpretation } from "@atomist/sdm-pack-analysis";
import { AutofixRegistration, CodeTransformRegistration } from "@atomist/sdm";

export class HuckleberryManager {

    public readonly huckleberries: Huckleberry<any>[];

    /**
     * Commands to transform
     * @return {Array<CodeTransformRegistration<{name: string}>>}
     */
    get commands(): Array<CodeTransformRegistration<{ name: string }>> {
        // Commands
        return this.huckleberries
            .map(huck => {
                return {
                    name: `add-hucklerry-${huck.name}`,
                    intent: `add huckleberry ${huck.name}`,
                    transform: huck.apply(huck.ideal),
                }
            });
        // TODO huck extractor command
    }

    get autofixes(): AutofixRegistration[] {
        return this.huckleberries
            .filter(huck => !!huck.ideal && !!huck.apply)
            .map(huck => {
                return {
                    name: `${huck.name}-autofix`,
                    transform: huck.apply(huck.ideal),
                }
            });
    }

    /**
     * Find all the Huckleberries we can manage in this project
     * @param {Interpretation} interpretation
     * @return {Promise<Array<Huckleberry<any>>>}
     */
    public async extract(interpretation: Interpretation): Promise<Array<Huckleberry<any>>> {
        return this.huckleberries
            .filter(huck => !!interpretation.reason.analysis.fingerprints[huck.name]);
    }

    /**
     * Which Huckleberries could grow in this project?
     * They may not all be present
     * @param {Interpretation} interpretation
     * @return {Promise<Array<Huckleberry<any>>>}
     */
    public async growable(interpretation: Interpretation): Promise<Array<Huckleberry<any>>> {
        const promises = this.huckleberries
            .map(h => h.canGrowHere(interpretation.reason.analysis));
        const relevant: boolean[] = await Promise.all(promises);
        return this.huckleberries.filter((h, i) => relevant[i]);
    }

    constructor(...huckleberries: Huckleberry<any>[]) {
        this.huckleberries = huckleberries;
    }
}