# agent-search-gateway-plugin-cnki

[agent-search-gateway](https://github.com/djasdh/agent_search_gateway) 的 **知网（CNKI）取件插件**（asg plugin）。

- 仓库 topic：**`asg-plugin`**
- 插件 id：`cnki`
- 能力：`fetch`（`pdf`）

## 安装

```bash
asg extensions install djasdh/agent-search-gateway-plugin-cnki@0.2.0
asg extensions list
```

> 0.2.0 同时带 `asg-extension.json`（V2）与 `asg-plugin.json`（V1）：
> 0.3.9 及以上优先使用 V2 manifest，0.3.8 及更早继续读 V1 manifest。

## 能力

插件接管以下 URL（`match` 只做纯 URL 判断）：

| URL | 行为 |
| --- | --- |
| `https://kns.cnki.net/kcms2/article/abstract?...` | 先做机构 IP 登录，再从摘要页找 `#pdfDown` / `#cajDown` 链接 |
| `https://*/zscsdoc/download?...` | 直接作为下载地址取件 |
| `https://*/bar/download/order?id=...` | 直接作为下载地址取件 |

流程要点：

1. `GenerateClientID` 拿 clientId → md5 签名 → `IpLoginFlushPo` 拿 `LID`（下载必需）；
2. 会话每次现开，插件自管 cookie，不跨请求持久化；
3. 按 `%PDF` 魔数判定产物（部分文献只有 HTML 阅读版）；
4. 下载大小受 `max_download_bytes` 限制，超限立即中止。

错误码：`CNKI_NO_SESSION`、`NOT_SUBSCRIBED`、`NO_PDF`、`NOT_PDF`、`TOO_LARGE`、`EMPTY`、`BAD_TARGET`、`NO_DOWNLOAD_LINK`。

## 配置

网关 0.3.9+ 使用插件私有配置（V2）：

```bash
asg extensions config cnki --set timeout_ms=15000
asg extensions config cnki --set max_download_bytes=1073741824
```

对应 `gateway.yaml`：

```yaml
extensions:
  cnki:
    config:
      timeout_ms: 15000
      max_download_bytes: 1073741824   # 1 GiB
```

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `timeout_ms` | `15000` | 单次请求超时（登录/摘要页/下载） |
| `max_download_bytes` | `1073741824` | 单次下载上限 |

旧版网关（0.3.8 及更早）继续读取通用 `fetch.*`：

```yaml
fetch:
  timeout_ms: 15000
  max_download_bytes: 1073741824
```

插件优先使用 `extensions.cnki.config`；字段缺失时回退旧 `fetch.*`，
两边都没有时用默认值（15000 / 1 GiB）。

需要在机构网段（或机构 VPN）内访问；否则 IP 登录拿不到 `LID`，会明确返回 `CNKI_NO_SESSION`。

## 开发

```bash
npm install
npm run build      # esbuild → 单文件 ESM index.mjs
npm test           # 构建 + vitest + node --test 冒烟测试
npm run typecheck  # tsc --noEmit
```

约束：

- 运行期只依赖 Node 内置模块（`node:crypto` 等），其余代码全部 bundle 进 `index.mjs`；
- 不 import `agent-search-gateway` 内部模块，也不依赖宿主 `node_modules`；
- `src/index.ts` 必须导出命名 `fetch`；
- `src/plugin.ts` 导出 `endpoints` / `policy`，测试用它们把请求指向本地桩服务器。

## 发版

1. 同步修改 `asg-extension.json`、`asg-plugin.json` 与 `package.json` 的版本号。
2. `git tag v0.2.0 && git push origin v0.2.0`。
3. GitHub Actions 执行 `npm ci` / `npm run typecheck` / `npm test` / `npm run build`，
   生成 `SHA256SUMS` 并创建 Release（`index.mjs`、`asg-extension.json`、
   `asg-plugin.json`、`SHA256SUMS`）。

## 发现

请给仓库加 GitHub topic **`asg-plugin`**，否则 `asg extensions search` 搜不到。

## License

MIT
