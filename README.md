# rspack-2.3-css-chunk-repro

Reproduces a Rspack 2.3.0 regression where loading initial shared CSS through an async chunk requests `undefined.undefined.chunk.css` and throws `ChunkLoadError`. The same fixture succeeds on 2.2.0.

This is a Node-only reproduction using clean, pinned Rspack packages. It has no application dependencies, loaders, plugins, patches or build cache.

## Run

Requires Node 20.19+ on the 20.x line, or Node 22.12+, and Yarn Classic. Verified with Node 24.13.0 and Yarn 1.22.5 on Linux x64.

```sh
yarn install
yarn test
```

`yarn test` runs both versions and exits **1** because 2.3.0 reproduces the bug. Run either version separately with:

```sh
node repro.mjs 2.2.0
node repro.mjs 2.3.0
```

| Version | Expected behavior    | Observed behavior                                                              | Exit |
| ------- | -------------------- | ------------------------------------------------------------------------------ | ---- |
| 2.2.0   | No CSS loading error | No new stylesheet request                                                      | 0    |
| 2.3.0   | No CSS loading error | Requests `/assets/undefined.undefined.chunk.css`, then throws `ChunkLoadError` | 1    |

The exact chunk ID and asset hash can change. The relevant output is:

```text
Rspack 2.2.0
Filename lookup: undefined.undefined.chunk.css
New CSS requests: []
PASS: no CSS load error

Rspack 2.3.0
Filename lookup: undefined.undefined.chunk.css
New CSS requests: ["/assets/undefined.undefined.chunk.css"]
ChunkLoadError: Loading css chunk 986 failed.
(error: undefined)
```

## What the fixture exercises

`index` imports `shared.css` initially. Both `index` and `other` import `Feature` asynchronously, and `Feature` also imports `shared.css`. Splitting all chunks creates a CSS chunk that is initial for `index` and also referenced by the async Feature group. Feature and Extra each have their own CSS, so the generated filename getter needs a lookup table rather than a constant filename.

The script compiles the fixture, finds that shared chunk in the real stats, and verifies its stylesheet exists on disk. It evaluates the generated `index` runtime in a Node VM and invokes its unchanged CSS-loading handler for that chunk. A tiny DOM shim presents the existing initial stylesheet and completes new link requests according to whether the requested file actually exists. No browser or network server is involved, and the entry modules themselves are not evaluated.

Both versions omit the shared initial chunk from the CSS filename table. In 2.2.0, `cssInstalledChunks` already marks it loaded, so the missing filename is not used. In 2.3.0, that cache starts empty and the loader consults the incomplete filename table. The malformed URL cannot match the existing stylesheet and does not resolve to an emitted asset.

The [upstream change to initial CSS loading](https://github.com/web-infra-dev/rspack/pull/15869) explains why the cache now starts empty: another entry may need to fetch CSS absent from its HTML. The report should preserve that behavior while fixing filename generation, rather than restore blanket loaded-state bookkeeping.

Generated bundles are in `dist/2.2.0/` and `dist/2.3.0/`. The local lockfile is ignored so a registry-specific install does not make the reproduction depend on a private registry. Both top-level core versions and their native binding versions are exact.

[ISSUE.md](ISSUE.md) contains a draft upstream report. The issue has not been submitted.
