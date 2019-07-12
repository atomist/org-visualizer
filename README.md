<p align="center">
  <img src="https://images.atomist.com/sdm/SDM-Logo-Dark.png">
</p>

# @atomist/org-visualizer

Visualize aspects of your organization. See [Rod Johnson's blog](https://blog.atomist.com/this-will-surprise-you/) for discussion of the motivation.

This app digs through your code and shows you how your projects differ in their language versions, library versions, docker open ports, etc.

Extensible, with out of the box
support for investigating the following aspects of your project:

- TypeScript
- Spring Boot (with Maven)
- Docker
- Library versions (npm, maven, python)
- Inclusion of a code of conduct

An example visualization, showing Docker images:

![Docker image visualization](images/dockerImageSunburst.png "Docker image skew")

## Running

To visualize your org, you can:

1. Clone and build this project
2. Run analysis on your repositories
3. Run the org_visualizer and hit its web interface.
4. If you have more ideas, add code to study more aspects of your projects

### Building

Please use Node 10+.

First, install with `npm ci`.

Next, build with `npm run build`

Next, `npm link` to out the `spider` command in your path. 

### Database setup

#### Creating the Database

Data about each repository is stored locally in a Postgres database.

Start Postgres, connect to it, and run the [create.ddl](ddl/create.ddl) script to set up the database. You can do this within the `psql` shell, or use the Postgres admin tool to create a database named `org_viz` and run all commands in that script after the line beginning with `\connect`.

#### Connecting to the Database

For anything other than the default Postgres [connection parameters](https://node-postgres.com/features/connecting) and db "org_viz":

Configure the Postgres database details in `client.config.json` in your `~/.atomist`:

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

You will need the following installed on your machine for the out of the box visualizations to work:

- The `git` binary
- Java
  - A JDK (*not* a JRE)
  - Maven - `mvn` must be on the path. 
- Node
- npm

 All artifacts referenced in Maven or Node projects must be accessible when the spider runs. Check by manually running `mvn` or `npm i` on the relevant projects.

### Analyze your repositories

>You can start quickly by loading data from four open source organizations by running the script `load-demo-data.sh`.

#### GitHub

To analyze a GitHub organization, run the following command:

`spider --owner <github organization>` e.g. `spider --owner atomist` (not the full org URL).

_To access private repositories, ensure that your GitHub token is available to 
Node processes via a `GITHUB_TOKEN` environment variable._

#### Local directories
To analyze local directories, wherever they were cloned from, use the `--l` flag and specify the full path of the parent directory of the repositories, as follows: 

```
spider --l /Users/rodjohnson/atomist/projects/spring-team/
```

#### General

>Run `spider` with the `--u` flag to force updates to existing analyses. Do this if you have updated your analyzer code. (See Extending below.) 

### Run the web app

Now start the server with `atomist start --local` to expose the visualizations.

Go to [http://localhost:2866](http://localhost:2866).

## Architecture

There are three architectural layers:

1. **Analysis**. This is predominantly done by implementing [Aspects](lib/customize/aspects.ts). Aspects know how to take fingerprints (extractions of small relevant bits) of the code, compare them, and even update them.
2. **Query** functionality.
3. Simple **UI** using static React and d3 exposing Sunburst charts.

All three layers are extensible and customizable.

## Extending

This project includes some well known aspects but it is intended for you to add your own.

Do this by updating the `aspects` constant defined in the [`aspects.ts`](lib/customize/aspects.ts) file. Simply add aspects to this array:

```typescript
export const Aspects: ManagedAspect[] = [
    DockerFrom,
    TypeScriptVersion,
    //... add your aspects here
```

>After updating your code you will need to rerun existing analyses. Run the spider again with the `--u` flag to force updates on existing data.

## Next Steps
The [Atomist](https://www.atomist.com) service is capable of keeping analyses up to date automatically, across all your repositories. It can also help to achieve consistency and convergence in eligible aspects by updating projects.

See [https://atomist.com/developer.html](https://atomist.com/developer.html) for further information.

-----

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
