import test from "node:test";
import assert from "node:assert/strict";

/** 构建产物冒烟测试：确认 index.mjs 可加载且 fetch 存在。 */
test("bundle 可加载并导出 fetch", async () => {
  const mod = await import("../index.mjs");
  assert.equal(typeof mod.fetch, "object");
  assert.equal(mod.fetch.id, "cnki");
  assert.equal(typeof mod.fetch.match, "function");
  assert.equal(typeof mod.fetch.fetch, "function");
  assert.equal(mod.fetch.match(new URL("https://kns.cnki.net/kcms2/article/abstract?v=abc")), true);
  assert.equal(mod.fetch.match(new URL("https://example.com/")), false);
});
