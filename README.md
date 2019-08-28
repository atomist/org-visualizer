  <img src="./images/dockerImageSunburst.png"
  width="130" height="130" align="right" />

# @atomist/org-visualizer

A tool for visualizing technology usage and drift across an organization. 

The cloud native era has led to an explosion of repositories, which we lack tools to understand and manage at scale. See Rod Johnson's blogs [This Will Surprise You](https://blog.atomist.com/this-will-surprise-you/) and [What's Lurking in Your Repositories](https://blog.atomist.com/whats-lurking/) for further discussion.

An Atomist **aspect** captures a concern in code or process. Aspects can access anything held in git: code and configuration and git data such as branch counts and committer activity. With the Atomist event hub, aspects can also capture data from your process, such as the characteristics of a push, build time and outcome.

Aspects support the following use cases:

1. *Visualization* (all aspects): See usage and drift across your organization.
2. *Convergence* (some aspects): Help drive code changes to achieve consistency on an ideal state of an aspect, such as a particularly version of a library.
3. *Reaction to change* (some aspects): React to changes in aspect usage within a project: for example, to a library upgrade, removing a Spring Boot Security starter or exposing an additional port in a Docker container.

This project focuses on the visualization use case. Visualizations are exposed via d3 sunburst charts and via a REST API returning JSON documents.

There is out of the box
support for investigating the following aspects of your project:

- TypeScript version
- Spring Boot version and starters (with Maven)
- Docker base images, Dockerfile path and exposed ports
- Java build tool (Maven, Gradle)
- Library versions (npm, Maven, Python)
- Inclusion of a code of conduct
- Common CI tools
- git activity and branch count

This repository also serves as an incubator for aspects that may graduate into other Atomist open source projects.

Analysis is extensible using the Atomist `Project` API. Implementing and registering additional aspect result in additional visualization links after re-analysis and restarting the application.

An example visualization, showing Docker images used across two GitHub organizations:

![Docker image visualization](images/dockerImageSunburst.png "Docker image drift")

## Running

To visualize your GitHub or local repositories:

1. Clone and build this project
2. Set up the required PostgreSQL database
3. Start the `org-visualizer` software delivery machine
4. Run analysis on your repositories via the Atomist CLI
5. Hit the web interface at [http://localhost:2866](http://localhost:2866)
6. If you have more ideas, add code to study more aspects of your projects

### Building

Please use Node 10+.

First, install with `npm ci`.

Next, build with `npm run build`

### Database setup

#### Creating the Database

Data about your repositories are stored locally in a PostgreSQL database.

Before starting to use `org-visualizer`, you need to create the required database by running the following command after
starting your local PostgreSQL server:

```
$ npm run db:create
```

To clean up and remove the database, run:

```
$ npm run db:delete
```

#### Connecting to the Database

For anything other than the default PostgreSQL [connection parameters](https://node-postgres.com/features/connecting) and db `org_viz`:

Configure the PostgreSQL database details in `client.config.json` in your `~/.atomist`:

```json
{
  "sdm": {
    "postgres": {
      "user": "<postgres user>",
      "password": "<postgres password",
      "host": "<postgres host>",
      "port": "<postgres port>",
      "database": "org_viz"
    }
  }
}
```

If `~/.atomist/client.config.json` does not exist, create it with the above content.

### Other Dependencies

You will need the following installed on your machine for the out of the box aspects to work:

- The `git` binary.
- Java
  - A JDK (*not* a JRE)
  - Maven - `mvn` must be on the path. 
- Node
- npm

`git` is always required. Java or Node binaries are required only if working with those technologies in the projects you are analyzed.

All artifacts referenced in Maven or Node projects must be accessible when the analysis runs. You can check this by manually running `mvn` or `npm i` on the relevant projects.

### Analyze your repositories

The `analyze` command is exposed by this org-visualizer project.
It works as at Atomist command, which runs through the `atomist` CLI.

* install the CLI: `npm i -g @atomist/cli`
* start the org_visualizer (in the org_visualizer project): `atomist start --local`

#### GitHub

To analyze a GitHub organization, run the following command:

```
atomist analyze github organization
```

Enter the GitHub owner name (e.g., `atomist`) at the prompt. Alternatively you can specify the owner parameter as a CLI argument to skip the prompt, as follows:

```
atomist analyze github organization --owner atomist
```

_To access private repositories, ensure that your GitHub token is available to 
Node processes via a `GITHUB_TOKEN` environment variable._

#### Local directories
To analyze local directories, wherever they were cloned from, specify the full path of the parent directory of the repositories, as follows: 

```
 atomist analyze local repositories --localDirectory /my/absolute/path/

```
> The directories must be `git` projects.

#### General

>Run `atomist analyze [local|github]` with `--update true` flag to force updates to existing analyses. Do this if you have updated your analyzer code. (See *Extending* below.) 

Use the `--cloneUnder [dir]` option to supply a stable directory under which all cloning should be performed. This will make subsequent analysis runs quicker.
Otherwise, temporary files will be used.

>If using a stable directory, make sure the directory exists and is writable
by the `org-visualizer` process. And keep an eye on disk usage, as these directories
are not transient and will not be deleted automatically.

### Run the web app

When the server is running with `atomist start --local`, you can see the visualizations.

Go to [http://localhost:2866](http://localhost:2866).

## Lifecycle
Atomist aspect functionality isn't limited to analyzing repositories. It is intended to be built into your delivery process, via an [Atomist SDM](https://github.com/atomist/sdm). This will ensure that your analyzes are always up to date, and that fingerprints can be extracted by delivery events such as builds.

### Fingerprinting on Push
The `org-visualizer` open source server is an SDM, meaning it can react to delivery events in repositories it manages. Running locally, it works with directories under a given base directory (by default, `~/atomist/projects/`), in which Atomist git hooks have been introduced.

Please refer to the `atomist clone` command for further information.

This SDM reacts to any push to the default branch of any managed repositories, calculating fingerprints.

### Delivery events
Atomist is designed to work with a wide range of events, not merely pushes. 

This SDM reacts to pushes of Maven projects and will attempt to build them, in order to trigger the [build time aspect](https://github.com/atomist/sdm-pack-aspect/blob/8457fd82fe8027e143f217dc62ded8ad50a622dc/lib/aspect/delivery/BuildAspect.ts#L71) that demonstrates the intersection of aspects with the delivery process. As your projects build, build time information will appear on the `org-visualizer` dashboard.

The build goal is set in [index.ts](https://github.com/atomist/org-visualizer/blob/08d9fa27c5ccb2db0fc8a07d8dac34b905edf0b9/index.ts#L108).  

> Atomist is a powerful delivery orchestration engine. An SDM can coordinate other tools, automatically fix code. See [Why You Need an SDM](https://the-composition.com/why-you-need-a-software-delivery-machine-85e8399cdfc0).

When using the Atomist service, event handling is automatically handled for repositories on GitHub, BitBucket or GitLab.

## Architecture

There are three architectural layers:

1. **Fingerprint extraction**. This is enabled by implementing [Aspects](lib/aspect/aspects.ts). Aspects know how to take **fingerprints** (extractions of small relevant bits) of the code, compare them, and even update them. Analysis is triggered by `atomist analyze` or by an SDM in response to a push.
2. **API** layer. Once your server is running, see the Swagger API documentation at [http://localhost:2866/api-docs](http://localhost:2866/api-docs)
3. Simple **UI** using static React and d3 exposing sunburst charts based on the API.

## Extending

This project includes some well known aspects but it is intended for you to add your own.

Do this by updating the `aspects` function defined in the [`aspects.ts`](lib/aspect/aspects.ts) file. Simply add aspects to this array:

```typescript
export function aspects(): Aspect[] {
    return [
        DockerFrom,
        TypeScriptVersion,
        //... add your aspects here
```

>After updating your code you will need to rerun existing analyses. Run `atomist analyze [local|github] --update true` again to force updates on existing data.

See the [developer guide](https://github.com/atomist/sdm-pack-aspect/blob/master/docs/developer.md) for more information.

## Next Steps
The [Atomist](https://www.atomist.com) service keeps analyses up to date automatically across all your repositories. It can also help to achieve consistency and convergence in eligible aspects by updating projects, and enabling workflows on change.

See [https://atomist.com/developer.html](https://atomist.com/developer.html) for further information.

-----

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
