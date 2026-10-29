# [Bug]: Initial shared CSS chunk resolves to undefined filename in 2.3.0

## System Info

```text
System:
  OS: Ubuntu 22.04 (Linux x64)
Binaries:
  Node: 24.13.0
  Yarn: 1.22.5
```

Rspack is installed under aliases:

```text
rspack-2-2: @rspack/core@2.2.0
rspack-2-3: @rspack/core@2.3.0
```

## Details

An async import fails in 2.3.0 when it references a CSS chunk already loaded by the entrypoint. Rspack requests `/assets/undefined.undefined.chunk.css` and throws `ChunkLoadError` instead of reusing the existing stylesheet. The same case works in 2.2.0.

The chunk is missing from `__webpack_require__.k`. Possibly related to [#15869](https://github.com/web-infra-dev/rspack/pull/15869).

## Reproduce link

https://github.com/jdb8/rspack-2.3-css-chunk-repro

## Reproduce Steps

```sh
git clone https://github.com/jdb8/rspack-2.3-css-chunk-repro.git
cd rspack-2.3-css-chunk-repro
yarn install
yarn test
```

The script runs both versions' generated CSS loaders in Node with a small DOM stub. 2.2.0 passes; 2.3.0 fails with `ChunkLoadError` (exit 1).
