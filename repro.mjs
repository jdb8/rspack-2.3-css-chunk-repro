import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import rspack220 from "rspack-2-2";
import rspack230 from "rspack-2-3";

import config from "./rspack.config.mjs";

const versions = { "2.2.0": rspack220, "2.3.0": rspack230 };
const selected = process.argv.slice(2);
const labels = selected.length ? selected : Object.keys(versions);

for (const version of labels) {
  const rspack = versions[version];
  assert(rspack, `Choose ${Object.keys(versions).join(" or ")}`);
  const outputPath = path.join(config.output.path, version);
  const compiler = rspack({ ...config, output: { ...config.output, path: outputPath } });
  const stats = await new Promise((resolve, reject) => {
    compiler.run((error, result) => {
      compiler.close((closeError) => {
        if (error || closeError) reject(error || closeError);
        else if (result.hasErrors()) reject(new Error(result.toString()));
        else resolve(result);
      });
    });
  });
  const data = stats.toJson({
    all: false,
    entrypoints: true,
    chunkGroups: true,
    chunks: true,
    ids: true,
  });
  const initialIds = data.entrypoints.index.chunks;
  const featureIds = data.namedChunkGroups.Feature.chunks;
  const shared = data.chunks.find(
    (chunk) =>
      initialIds.includes(chunk.id) &&
      featureIds.includes(chunk.id) &&
      chunk.files.some((file) => file.endsWith(".css")),
  );
  assert(shared, "Fixture must produce CSS shared by initial index and async Feature");
  const cssFile = shared.files.find((file) => file.endsWith(".css"));
  assert(fs.existsSync(path.join(outputPath, cssFile)), "Shared stylesheet must exist");
  const expectedHref = `/assets/${cssFile}`;
  const requests = [];
  const createLink = () => {
    const attributes = new Map();
    return {
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      getAttribute(name) {
        return attributes.get(name) ?? null;
      },
      removeAttribute(name) {
        attributes.delete(name);
      },
    };
  };

  // Pretend the initial stylesheet is already in HTML, as in the original failure.
  // Only resource insertion is simulated: the compiled CSS loader runs unchanged.
  const document = {
    baseURI: "https://example.test/",
    getElementsByTagName: (tag) =>
      tag === "link" ? [{ ...createLink(), rel: "stylesheet", href: expectedHref }] : [],
    createElement: createLink,
    head: {
      appendChild(link) {
        requests.push(link.href);
        queueMicrotask(() => {
          const exists = fs.existsSync(path.join(outputPath, link.href.slice("/assets/".length)));
          const type = exists ? "load" : "error";
          link[`on${type}`]({ type, target: link });
        });
      },
    },
  };
  const context = vm.createContext({ document, self: {}, setTimeout, clearTimeout });
  const runtime = fs.readFileSync(path.join(outputPath, "runtime~index.js"), "utf8");
  vm.runInContext(
    `${runtime}\nself.reproChunks.push([['probe'], {}, runtime => { globalThis.runtime = runtime; }]);`,
    context,
  );
  const promises = [];
  context.runtime.f.css(shared.id, promises);
  const error = await Promise.all(promises).then(
    () => null,
    (failure) => failure,
  );

  console.log(`\nRspack ${rspack.rspackVersion}`);
  console.log(`Shared initial CSS chunk: ${shared.id}`);
  console.log(`Existing stylesheet: ${expectedHref}`);
  console.log(`Filename lookup: ${context.runtime.k(shared.id)}`);
  console.log(`New CSS requests: ${JSON.stringify(requests)}`);
  console.log(error ? `${error.name}: ${error.message}` : "PASS: no CSS load error");
  if (error) process.exitCode = 1;
}
