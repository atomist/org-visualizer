spider<p align="center">
  <img src="https://images.atomist.com/sdm/SDM-Logo-Dark.png">
</p>

# @atomist/org-visualizer

Visualize aspects of your organization. See [Rod Johnson's blog](https://blog.atomist.com/this-will-surprise-you/) for discussion of the motivation.

Extensible, with out of the box
support for the following queries:

- TypeScript
- Spring Boot (with Maven)
- Docker
- Library versions
- Inclusion of a code of conduct

An example visualization, showing Docker images:

![Docker image visualization](images/dockerImageSunburst.png "Docker image skew")

## Running

Please use Node 10+.

First, install with `npm i`.

Next, build with `npm run build`

Next, `npm link` to create the `spider` binary.

### Database setup

#### Creating the Database

Data about each repository is stored locally in Postgres.

Please start Postgres, connect to it, and run the [create.ddl](ddl/create.ddl) script to set up the database. You can do this within the `psql` shell, or use the Postgres admin tool to create a database named `org-viz` and run all commands in that script after the line beginning with `\connect`.

#### Connecting to the Database

Configure the Postgres database details in `client.confjg.json` in your `~/.atomist`:

```json
{
  "sdm": {
    "postgres": {
      "user": "<postgres user>",
      "password": "<postgres password",
      "host": "<postgres host>",
      "port": "<postgres port>",
      "database": "org_wiz"
    }
  }
}
```

### Other Dependencies

You will need the following installed on your machine to run this SDM:

- The `git` binary
- Maven
- Node
- npm

### Analyze your repositories

`spider --owner <github organization>` e.g. `spider --owner atomist` (not the full org URL)

Now start the server with `atomist start --local` to expose the visualizations.

Go to [http://localhost:2866](http://localhost:2866).

_If you wish to access private repositories, ensure that your GitHub token is available to 
Node processes via a `GITHUB_TOKEN` environment variable. (This will
never be sent to Atomist.)_

## Architecture

There are three architectural layers:

1. **Analysis**. This is predominantly done by implementing [Features](https://github.com/atomist/sdm-pack-fingerprints/blob/95f2213759de26e6fe6a6e78edff8b36fa357f08/lib/machine/Feature.ts#L131) from [@atomist/sdm-pack-fingerprints](https://github.com/atomist/sdm-pack-fingerprints). This also extends to the project analysis framework, from [@atomist/sdm-pack-analysis](https://github.com/atomist/sdm-pack-analysis). Scanners extract data
2. **Query** functionality.
3. Simple **UI** using React and d3 exposing Sunburst charts.

All three layers are extensible and customizable.

-----

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
