spider<p align="center">
  <img src="https://images.atomist.com/sdm/SDM-Logo-Dark.png">
</p>

# @atomist-blogs/sunburster

Visualize aspects of your organization. Extensible, with out of the box
support for 

- TypeScript
- Spring Boot (with Maven)
- Docker
- Library versions
- Code of conduct

## Running

Please use Node 10+.

First, install with `npm i`.

Next, build with `npm run build`

Next, `npm link` to create the `spider` binary.

`spider <github organization>` e.g. `spider atomist` (not the full org URL)

Now start the server with `atomist start --local` to expose the visualizations.

Go to http://localhost:2866

<i>If you wish to access private repositories, ensure that your GitHub token is available to 
Node processes via a `GITHUB_TOKEN` environment variable. (This will
never be sent to Atomist.)<i>

## Architecture

There are three architectural layers:

1. Project analysis framework, from @atomist/sdm-pack-analysis. Scanners extract data
2. Query functionality.
3. Simple UI using Handlebars and d3 exposing Sunburst charts.

All three layers are extensible and customizable.

-----

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
