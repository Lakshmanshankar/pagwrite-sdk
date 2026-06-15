# @lakshmanshankar/pagwrite-astro

Astro integration for fetching Pagewrite CMS content at build time and writing it as MDX files into your Astro content directory.

This package is currently focused on the Astro fetch/write integration. The lower-level fetch and staging functions are exported so they can later be reused by another adapter, such as Next.js or Fumadocs.

## How It Works

```text
Pagewrite CMS                  User's Astro project
-------------                  --------------------
Build token secret      --->    REMOTE_MDX_TOKEN
siteId                  --->    @lakshmanshankar/pagwrite-astro config
                                  |
                                  v
                               astro build
                                  |
                                  v
                         fetch static file tree
                         fetch paginated file documents
                                  |
                                  v
                         src/content/docs/*.mdx
```

## Installation

```bash
pnpm add @lakshmanshankar/pagwrite-astro
```

## Setup

Set a build token in your local or CI environment:

```bash
REMOTE_MDX_TOKEN=rmx_live_xxxxxxxxxxxx
```

Configure the integration before content-related integrations in `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import pagewriteAstro from "@lakshmanshankar/pagwrite-astro";

export default defineConfig({
  integrations: [
    pagewriteAstro({
      siteId: "your-site-id",
    }),
    mdx(),
  ],
});
```

## Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `siteId` | `string` | required | Pagewrite site to fetch and stage. |
| `token` | `string` | none | Build token value. Takes priority over env lookup. |
| `tokenEnvVar` | `string` | `REMOTE_MDX_TOKEN` | Environment variable name to read the token from. |
| `outputDir` | `string` | `src/content/docs` | Directory where MDX files are written, relative to the Astro project root. |
| `clean` | `boolean` | `false` | Remove `outputDir` before writing fetched files. |
| `verbose` | `boolean` | `false` | Reserved for more detailed sync logging. |

## Examples

### Custom Output Directory

```js
pagewriteAstro({
  siteId: "your-site-id",
  outputDir: "src/content/blog",
});
```

### Clean Sync For CI

```js
pagewriteAstro({
  siteId: "your-site-id",
  clean: true,
});
```

### Custom Token Env Var

```js
pagewriteAstro({
  siteId: "your-site-id",
  tokenEnvVar: "PAGEWRITE_BUILD_TOKEN",
});
```


## Ad-Hoc Fetching

You can fetch content outside the Astro build by running the CLI in a predeploy step, CI job, or local verification command:

```bash
pagewrite-content fetch --site-id your-site-id --out src/content/docs
```

For CI, wire it before your framework build:

```json
{
  "scripts": {
    "content:fetch": "pagewrite-content fetch --site-id $PAGEWRITE_SITE_ID --out src/content/docs --clean",
    "prebuild": "pnpm content:fetch",
    "build": "astro build"
  }
}
```

To verify the remote content without keeping files on disk, use dry run:

```bash
pagewrite-content fetch --site-id your-site-id --dry-run
```

CLI options mirror the integration defaults: `--token`, `--token-env`, `--clean`, `--page-size`, and `--timeout-ms` are available.

See [CLI.md](./CLI.md) for the full command reference and CI examples.

## Lower-Level API

The package also exports the reusable content staging primitives:

```ts
import {
  fetchStaticFileTree,
  fetchAllFileDocuments,
  stageSiteContent,
} from "@lakshmanshankar/pagwrite-astro";

await stageSiteContent("your-site-id", process.env.REMOTE_MDX_TOKEN!, "./content/docs");
```

`stageSiteContent` fetches the static file tree and paginated file documents, converts file tree paths into safe MDX file paths, upserts `title` and `slug` frontmatter, and writes files to the target directory.

## Publishing

Package publishing is handled by GitHub Actions. Configure an `NPM_TOKEN` repository secret with permission to publish `@lakshmanshankar/pagwrite-astro`, then publish a GitHub release to run the npm publish workflow.

The workflow installs dependencies with pnpm, runs typecheck, tests, and build, then publishes to the npm registry with provenance enabled. It can also be started manually from the Actions tab with `workflow_dispatch`.

## Security Notes

- Never commit build tokens.
- Build tokens should be read-only and scoped to fetch site content.
- File tree paths are normalized and checked before writing.
- Missing tokens, API failures, invalid tree responses, and disk write errors fail the Astro build.
