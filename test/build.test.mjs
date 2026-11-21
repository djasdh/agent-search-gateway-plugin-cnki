import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** 构建产物冒烟测试：V2 manifest 与 index.mjs 的契约一致。 */
test("V2 manifest 字段正确且版本与 package.json 一致", async () => {
  const manifest = JSON.parse(await readFile(new URL("../asg-extension.json", import.meta.url), "utf8"));
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(manifest.id, "cnki");
  assert.equal(manifest.api_version, 2);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.entry, "index.mjs");
  assert.deepEqual(manifest.provides, ["fetch"]);
  assert.equal(manifest.fetch_channels?.[0]?.id, "cnki:http");
  assert.equal(manifest.backends, undefined);
});

test("V1 manifest 保留且版本一致", async () => {
  const manifest = JSON.parse(await readFile(new URL("../asg-plugin.json", import.meta.url), "utf8"));
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(manifest.id, "cnki");
  assert.equal(manifest.api_version, 1);
  assert.equal(manifest.version, pkg.version);
});

test("bundle 可加载并导出 fetch", async () => {
  const mod = await import("../index.mjs");
  assert.equal(typeof mod.fetch, "object");
  assert.equal(mod.fetch.id, "cnki");
  assert.equal(typeof mod.fetch.match, "function");
  assert.equal(typeof mod.fetch.fetch, "function");
  assert.equal(mod.fetch.match(new URL("https://kns.cnki.net/kcms2/article/abstract?v=abc")), true);
  assert.equal(mod.fetch.match(new URL("https://example.com/")), false);
});
