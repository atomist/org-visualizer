# Developer Guide

This is an extensible platform. You can write your own code to comprehend aspects unique to your projects, and also contribute code that will be useful to other users.

In keeping with the Atomist philosophy of *do it in code*, extensibility is in TypeScript code.

The following are the key extension points:

- **Aspects**, which extract *fingerprint* data from projects allowing visualization and (optionally) rolling out updates and on-change workflows.
- **Taggers**, which provide insights based on aspects.
- **Custom reporters**, which can use data captured by aspects for wholly custom reports.

The key underlying concept is that of a **fingerprint**: a snapshot of a concern within a project--for example, the version of a particular library. However, fingerprints can encompass much more than merely dependencies. User examples include:

-  The state of particular security files
-  Logging configuration
-  The configuration of metrics export
-  Canonicalized representation of sensitive code that, when changed, should trigger stringent review
-  Library usage
-  Language usage
-  SQL statements and database usage
 
Fingerprints are persisted and are the basis for querying and visualization. Tags are not persisted, but are purely a projection to support querying. This distinction is important to consider when choosing between the two approaches for something that could be implemented with either.

## Aspects

### Aspect interface
The following are the basic methods on all aspects:

```typescript
export interface BaseAspect<FPI extends FP = FP> {

    /**
     * Displayable name of this aspect. Used only for reporting.
     */
    readonly displayName: string;

    /**
     * prefix for all fingerprints that are emitted by this Aspect
     */
    readonly name: string;

    /**
     * Link to documentation for this Aspect. This can help people
     * understand the results graphs and results from the analysis
     * enabled here.
     *
     * You might provide a link to the typedoc for Aspects you define,
     * or an internal page describing why you created this and what
     * people can do about their results.
     */
    readonly documentationUrl?: string;

    /**
     * Function to apply the given fingerprint instance to a project
     */
    apply?: ApplyFingerprint<FPI>;

    summary?: DiffSummaryFingerprint;

    /**
     * Functions that can be used to compare fingerprint instances managed by this
     * aspect.
     */
    comparators?: Array<FingerprintComparator<FPI>>;

    /**
     * Convert a fingerprint value to a human readable string
     * fpi.data is a reasonable default
     */
    toDisplayableFingerprint?(fpi: FPI): string;

    /**
     * Convert a fingerprint name such as "npm-project-dep::atomist::automation-client"
     * to a human readable form such as "npm package @atomist/automation-client"
     * @param {string} fingerprintName
     * @return {string}
     */
    toDisplayableFingerprintName?(fingerprintName: string): string;

    /**
     * Validate the aspect. Return undefined or the empty array if there are no problems.
     * @return {Promise<ReviewComment[]>}
     */
    validate?(fpi: FPI): Promise<ReviewComment[]>;

    /**
     * Based on the given fingerprint type and name, suggest ideals
     * order of recommendation strength
     */
    suggestedIdeals?(type: string, fingerprintName: string): Promise<Ideal[]>;

    /**
     * Workflows to be invoked on a fingerprint change. This supports use cases such as
     * reacting to a potential impactful change and cascading changes to other projects.
     */
    workflows?: FingerprintDiffHandler[];

    /**
     * Indications about how to calculate stats for this aspect across
     * multiple projects. An aspect without AspectStats will have its entropy
     * calculated by default.
     */
    stats?: AspectStats;
}
```
The `Aspect` interface is most commonly used:

```typescript
export interface Aspect<FPI extends FP = FP> extends BaseAspect<FPI> {

    /**
     * Function to extract fingerprint(s) from this project
     */
    extract: ExtractFingerprint<FPI>;

}
```

### Core aspect methods
The following methods are required for any aspect:

- `name`: Must be unique in your workspace.
- `displayName`: Human readable name.
- `extract` (regular aspects): Extract zero or more fingeprints from the current project.

### Enabling updates
Convergence to ideal

Key method is `apply`.

If you're familiar with Atomist concepts, this is a *code transform*. You use the `Project` API to effect updates and Atomist takes care of rolling out the changes across as many repositories as are needed.

tbd

### Workflows
Aspects can respond to change in the managed fingerprint.

tbd

## Taggers
Taggers work with fingerprints emitted by aspects to provide particular insights. Taggers are simpler to write than aspects.

Taggers do not have access to project data so can be created and updated without the need to re-analyze to update persistent data.

### Simple taggers

A tagger is an object with a name, description and test method taking a single fingerprint. Taggers will be invoked for each fingerprint on a project. Taggers are normally created as object literals. For example:

```typescript
{ 
	name: "docker", 
	description: "Docker status", 
	test: fp => fp.type === DockerFrom.name 
}

```
This will cause every project that has a fingerprint of type `DockerFrom.name` to be tagged with `docker`.

### "Combination" taggers
A "combination" tagger is an object with a name, description and test method taking all fingerprints on a particular repository. This enables them to check for the combination of fingerprints.

For example:

```typescript
{
    name: "hot",
    description: "How hot is git",
    test: fps => {
        // Find recent repos
        const grt = fps.find(fp => fp.type === GitRecencyType);
        const acc = fps.find(fp => fp.type === GitActivesType);
        if (!!grt && !!acc) {
            const days = daysSince(new Date(grt.data));
            if (days < 3 && acc.data.count > 2) {
                return true;
            }
        }
        return false;
    },
}
```
This will cause every project that has a `GitRecency` fingerprint of less than 3 days ago and a `GitActives` fingerprint showing 3 or more active committers to the default branch to be tagged with `hot`.

> Most use cases can be satisfied using simple taggers. Don't use combination taggers without good reason.

### Prompting action
Taggers have an optional `severity` property for which the legal values are `info`, `warn` and `error`. If you set this value to `warn` or `error` the severity will be returned along with the data payload and the UI will prominently render the relevant tag.

## Adding your aspects and taggers

Do this by updating the `aspects` constant defined in the [`aspects.ts`](../lib/customize/aspects.ts) file. Add aspects to the `Aspects` array:

```typescript
export const Aspects: ManagedAspect[] = [
    DockerFrom,
    TypeScriptVersion,
    //... add your aspects here
```

Add your simple or combination taggers to the array in the `taggers.ts` file in the same directory.

## Advanced Concepts

### Custom Reports

To add custom reports, add to the record type in `lib/customize/customReporters.ts`. Writing a custom type is only necessary for unusual requirements.

### Aspect granularity and composition
Keep your aspects fine-grained. An aspect should address a single concern.

Aspects can depend on other aspects. 
tbc

### Fingerprints

Fingerprints may need to be canonicalized.

### Stats
stats path

tbd

### Efficiency

All aspect `extract` methods need to run on every push to the default branch, and on an all repositories when a new organization is onboarded into the Atomist service. Thus it is important to consider the cost of their implementation.

Avoid retrieving more data than necessary. Some tips:

- If possible, ask for files by path via `project.getFile(path)` rather than iterating over files
- Use the most specific glob patterns possible
- When iterating over files and looking at content, exclude binary files using `file.isBinary()`
- Perform file iteration via generator utility methods in the `Project` API, terminating iteration once you've found what you want.


