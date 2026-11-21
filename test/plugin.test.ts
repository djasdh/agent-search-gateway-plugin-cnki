import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fetch as plugin } from "../src/index.js";
import { DEFAULT_MAX_DOWNLOAD_BYTES, DEFAULT_TIMEOUT_MS, endpoints, policy, resolveFetchLimits } from "../src/plugin.js";
import type { FetchPluginContext } from "../src/sdk/fetch-plugin.js";
import type { FetchSettings } from "../src/sdk/settings.js";

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function pluginCtx(
  overrides: Partial<FetchSettings> = {},
  pluginConfig?: Readonly<Record<string, unknown>>,
): FetchPluginContext {
  return {
    settings: {
      fetch: {
        timeout_ms: 4000,
        max_bytes: 5 * 1024 * 1024,
        user_agent: "",
        max_download_bytes: 4 * 1024 * 1024,
        ...overrides,
      },
    },
    secrets: { bilibili: { http: { token: "" } } },
    getSecret: () => undefined,
    logger: silentLogger,
    ...(pluginConfig === undefined ? {} : { pluginConfig }),
  };
}

const PDF = Buffer.concat([Buffer.from("%PDF-1.6\n"), Buffer.alloc(512, 0x20)]);

const ABSTRACT_HTML = `<!doctype html><html><body>
  <div class="download-btns">
    <li class="btn-dlcaj"><a id="cajDown" name="cajDown" href="/bar/download/order?id=caj">CAJ下载</a></li>
    <li class="btn-dlpdf"><a id="pdfDown" name="pdfDown" href="/bar/download/order?id=pdf">PDF下载</a></li>
  </div></body></html>`;

/** 桩服务器行为开关。 */
let behaviour: "ok" | "not-subscribed" | "htmlread" | "no-lid" | "bad-target" | "huge" = "ok";
let server: ReturnType<typeof createHttpServer>;
let base = "";

beforeAll(async () => {
  server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;

    if (path.endsWith("/GenerateClientID")) {
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "SID_recsys=1; Path=/" });
      res.end(JSON.stringify({ Success: true, Code: 1, Data: "client-1" }));
      return;
    }
    if (path.endsWith("/IpLoginFlushPo")) {
      const cookies = behaviour === "no-lid" ? ["Ecp_ClientId=client-1"] : ["Ecp_ClientId=client-1", "LID=ticket-1"];
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": cookies });
      // 实测响应体是带外层括号的非标准 JSON
      res.end('({"IsSuccess":true,"ShowName":"测试机构"})');
      return;
    }
    if (path.includes("/kcms2/article/abstract")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (behaviour === "not-subscribed") {
        res.end("<html><body><div>您当前所属机构未订购该资源</div></body></html>");
      } else if (behaviour === "bad-target") {
        res.end('<html><body><a id="pdfDown" href="http://evil.example/steal">PDF下载</a></body></html>');
      } else {
        res.end(ABSTRACT_HTML);
      }
      return;
    }
    if (path.startsWith("/bar/download/order")) {
      res.writeHead(302, { Location: `${base}/docdown/fulltext/download?q=1` });
      res.end();
      return;
    }
    if (path.startsWith("/docdown/fulltext/download")) {
      if (behaviour === "htmlread") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end('<html><body><script src="./js/htmlread.js"></script>htmlread</body></html>');
        return;
      }
      const body = behaviour === "huge" ? Buffer.alloc(64 * 1024, 0x41) : PDF;
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": String(body.byteLength) });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end("nope");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  behaviour = "ok";
  endpoints.clientId = `${base}/RCDService/api/UtilityOpenApi/GenerateClientID`;
  endpoints.login = `${base}/TopLoginCore/api/loginapi/IpLoginFlushPo`;
  endpoints.knsBase = base;
  policy.cnkiHostSuffix = "127.0.0.1";
});

describe("match", () => {
  it("命中知网摘要页 / 下载链接", () => {
    const original = policy.cnkiHostSuffix;
    policy.cnkiHostSuffix = "cnki.net";
    try {
      expect(plugin.match(new URL("https://kns.cnki.net/kcms2/article/abstract?v=abc"))).toBe(true);
      expect(plugin.match(new URL("https://pay.cnki.net/zscsdoc/download?filename=X&dbtype=CAPJ"))).toBe(true);
      expect(plugin.match(new URL("https://bar.cnki.net/bar/download/order?id=1"))).toBe(true);
      expect(plugin.match(new URL("https://example.com/kcms2/article/abstract"))).toBe(false);
      expect(plugin.match(new URL("https://kns.cnki.net/kns8s/brief/grid"))).toBe(false);
    } finally {
      policy.cnkiHostSuffix = original;
    }
  });

  it("导出形状符合运行期契约", () => {
    expect(plugin.id).toBe("cnki");
    expect(plugin.platform).toBe("cnki");
    expect(typeof plugin.match).toBe("function");
    expect(typeof plugin.fetch).toBe("function");
    expect(plugin.capabilities).toEqual(["pdf"]);
  });
});

describe("有效设置", () => {
  it("只有旧 settings.fetch 时行为不变", () => {
    expect(resolveFetchLimits(pluginCtx())).toEqual({
      timeoutMs: 4000,
      maxDownloadBytes: 4 * 1024 * 1024,
    });
  });

  it("pluginConfig 同时覆盖 timeout_ms 与 max_download_bytes", () => {
    expect(
      resolveFetchLimits(pluginCtx({}, { timeout_ms: 12000, max_download_bytes: 2048 })),
    ).toEqual({ timeoutMs: 12000, maxDownloadBytes: 2048 });
  });

  it("pluginConfig 缺字段时回退旧值", () => {
    expect(resolveFetchLimits(pluginCtx({}, { timeout_ms: 9000 }))).toEqual({
      timeoutMs: 9000,
      maxDownloadBytes: 4 * 1024 * 1024,
    });
    expect(resolveFetchLimits(pluginCtx({}, { max_download_bytes: 1234 }))).toEqual({
      timeoutMs: 4000,
      maxDownloadBytes: 1234,
    });
  });

  it("pluginConfig 非法值被忽略", () => {
    expect(
      resolveFetchLimits(pluginCtx({}, { timeout_ms: 0, max_download_bytes: -1 })),
    ).toEqual({ timeoutMs: 4000, maxDownloadBytes: 4 * 1024 * 1024 });
    expect(
      resolveFetchLimits(pluginCtx({}, { timeout_ms: 1.5, max_download_bytes: "2048" })),
    ).toEqual({ timeoutMs: 4000, maxDownloadBytes: 4 * 1024 * 1024 });
  });

  it("两边都缺字段时用默认值", () => {
    const ctx = {
      settings: { fetch: {} },
      secrets: { bilibili: { http: { token: "" } } },
      getSecret: () => undefined,
      logger: silentLogger,
      pluginConfig: {},
    } as unknown as FetchPluginContext;
    expect(resolveFetchLimits(ctx)).toEqual({
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxDownloadBytes: DEFAULT_MAX_DOWNLOAD_BYTES,
    });
  });
});

describe("fetch", () => {
  it("摘要页 → #pdfDown → 跟随重定向拿到 %PDF", async () => {
    const r = await plugin.fetch(new URL(`${base}/kcms2/article/abstract?v=abc`), pluginCtx());
    expect(r.ok).toBe(true);
    expect(r.contentType).toBe("application/pdf");
    expect(r.bytes?.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(r.finalUrl).toContain("/docdown/fulltext/download");
  });

  it("直接给下载链接也能取件", async () => {
    const r = await plugin.fetch(new URL(`${base}/bar/download/order?id=pdf`), pluginCtx());
    expect(r.ok).toBe(true);
    expect(r.bytes?.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("IP 登录拿不到 LID → CNKI_NO_SESSION（不静默返回 HTML）", async () => {
    behaviour = "no-lid";
    const r = await plugin.fetch(new URL(`${base}/kcms2/article/abstract?v=abc`), pluginCtx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("CNKI_NO_SESSION");
  });

  it("未订购的摘要页 → NOT_SUBSCRIBED", async () => {
    behaviour = "not-subscribed";
    const r = await plugin.fetch(new URL(`${base}/kcms2/article/abstract?v=abc`), pluginCtx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("NOT_SUBSCRIBED");
  });

  it("只有 HTML 阅读版（无 PDF 版）→ NO_PDF", async () => {
    behaviour = "htmlread";
    const r = await plugin.fetch(new URL(`${base}/kcms2/article/abstract?v=abc`), pluginCtx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("NO_PDF");
  });

  it("超过 fetch.max_download_bytes → TOO_LARGE（不把大文件读进内存）", async () => {
    behaviour = "huge";
    const r = await plugin.fetch(
      new URL(`${base}/bar/download/order?id=pdf`),
      pluginCtx({ max_download_bytes: 1024 }),
    );
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("TOO_LARGE");
  });

  it("pluginConfig.max_download_bytes 覆盖旧上限（错误文本用有效值）", async () => {
    behaviour = "huge";
    const r = await plugin.fetch(
      new URL(`${base}/bar/download/order?id=pdf`),
      pluginCtx({ max_download_bytes: 4 * 1024 * 1024 }, { max_download_bytes: 1024 }),
    );
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("TOO_LARGE");
    expect(r.errorMessage).toContain("1024");
    expect(r.errorMessage).toContain("extensions.cnki.config.max_download_bytes");
  });

  it("摘要页指向站外地址 → BAD_TARGET（不跟随到非知网域名）", async () => {
    behaviour = "bad-target";
    const r = await plugin.fetch(new URL(`${base}/kcms2/article/abstract?v=abc`), pluginCtx());
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("BAD_TARGET");
  });
});
