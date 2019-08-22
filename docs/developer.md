# Developer Guide

The greatest value of `org-visualizer` is the potential to extend it for your team to help you understand and take control of important aspects of code, configuration and process.

In keeping with the Atomist philosophy of *do it in code*, extensibility is in TypeScript code.

You can write your own code to comprehend aspects unique to your projects, and also contribute code that will be useful to other users.

The following are the key extension points:

- **Aspects**, which extract *fingerprint* data from repositories allowing visualization and (optionally) rolling out updates and on-change workflows.
- **Taggers**, which provide insights based on fingerprint data extracted by aspects.
- **Scorers**, which help to rank repositories based on fingerprint data. Scorers enable you to gamify development at scale and reward or penalize good or bad usages.
- **Custom reporters**, which can use data captured by aspects for wholly custom reports.

The key underlying concept is that of a **fingerprint**: a snapshot of a concern within a project--for example, the version of a particular library. However, fingerprints can encompass much more than merely dependencies. Out of the box examples include:

- Docker base images and ports
- Spring Boot version
- .NET target framework
- CI pipeline files
- Exposed secrets
- Git branching and recency of commit activity

User examples include:

-  The presence and state of particular security files
-  Logging configuration
-  The configuration of metrics export
-  Canonicalized representation of sensitive code that, when changed, should trigger stringent review
-  Library usage idioms in code
-  Language usage
-  SQL statements and database usage
 
Fingerprints are persisted and are the basis for querying and visualization. Tags are not persisted, but are purely a projection to support querying. This distinction is important to consider when choosing between the two approaches for something that could be implemented with either.

## Aspects

### Aspect interface
The following are the methods share by all aspects. Many are optional:

```typescript
export interface Aspect<FPI extends FP = FP> {

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
     * Function to extract fingerprint(s) from this project
     */
    extract: ExtractFingerprint<FPI>;

    /**
     * Function to apply the given fingerprint instance to a project
     */
    apply?: ApplyFingerprint<FPI>;

    summary?: DiffSummaryFingerprint;

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


### Core aspect methods
The following methods are usually the most important:

- `name`: An aspect's name be unique in your workspace.
- `displayName`: Human readable name.
- `extract` (regular aspects): Extract zero or more fingeprints from the current project.

### The extract method
tbc

Fingerprint interface - 


Example

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

Do this by updating the `aspects` constant defined in the [`aspects.ts`](../lib/aspect/aspects.ts) file. Add aspects to the `Aspects` array:

```typescript
export const Aspects: ManagedAspect[] = [
    DockerFrom,
    TypeScriptVersion,
    //... add your aspects here
```

Add your simple or combination taggers to the array in the `taggers.ts` file in the same directory.

## Scorers
Implement a `RepositoryScorer` function:

```typescript
/**
 * Function that knows how to score a repository.
 * @param repo repo we are scoring
 * @param allRepos context of this scoring activity
 * @return undefined if this scorer doesn't know how to score this repository.
 */
export type RepositoryScorer = (repo: TaggedRepo, allRepos: TaggedRepo[]) => Promise<Score | undefined>;

```
Normally only the first argument is used.

> Scorers work with data extracted by aspects.

An example:

```typescript
export const TypeScriptProjectsMustUseTsLint: RepositoryScorer = async repo => {
    const isTs = repo.analysis.fingerprints.find(fp => fp.type === TypeScriptVersionType);
    if (!isTs) {
        return undefined;
    }
    const hasTsLint = repo.analysis.fingerprints.find(fp => fp.type === TsLintType);
    return {
        name: "has-tslint",
        score: hasTsLint ? 5 : 1,
        reason: hasTsLint ? "TypeScript projects should use tslint" : "TypeScript project using tslint",
    };
};
````

## Advanced Concepts

### Custom Reports

To add custom reports, add to the record type in `lib/customize/customReporters.ts`. Writing a custom type is only necessary for unusual requirements.

### Aspect granularity and composition
Keep your aspects fine-grained. An aspect should address a single concern.

Aspects can depend on other aspects. 
tbc

### Fingerprints

Fingerprints may need to be canonicalized.
tbc

### Stats
stats path

tbc

### Efficiency

All aspect `extract` methods need to run on every push to the default branch, and on an all repositories when a new organization is onboarded into the Atomist service. Thus it is important to consider the cost of their implementation.

Avoid retrieving more data than necessary. Some tips:

- If possible, ask for files by path via `project.getFile(path)` rather than iterating over files
- Use the most specific glob patterns possible
- When iterating over files and looking at content, exclude binary files using `file.isBinary()`
- Perform file iteration via generator utility methods in the `Project` API, terminating iteration once you've found what you want.

### VirtualProjectFinder

Some repositories contain multiple *virtual* projects: projects one or more level down from the root. For example, there may be a Java backend service in one directory and a React web app in another.

The `VirtualRepoFinder` interface enables `org-visualizer` to comprehend such virtual projects.

This is configured in `aspects.ts` as follows:

```typescript
const virtualProjectFinder: VirtualProjectFinder = fileNamesVirtualProjectFinder(
    "package.json", "pom.xml", "build.gradle", "requirements.txt",
);
```

This identifies Node projects, Maven and Gradle projects and Python projects.

You can add more files to this list, or even implement your own `VirtualProject` finder by implementing the following interface:


```typescript
export interface VirtualProjectFinder {
    readonly name: string;
    /**
     * Determine virtual project information for this project
     * @param {Project} project
     * @return {Promise<VirtualProjectInfo>}
     */
    findVirtualProjectInfo: (project: Project) => Promise<VirtualProjectInfo>;
}
```





