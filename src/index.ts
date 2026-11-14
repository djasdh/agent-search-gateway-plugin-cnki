/**
 * 插件入口：按 asg 运行期约定导出命名 `fetch`。
 *
 * 实现放在 `plugin.ts`，避免本模块的 `fetch` 绑定遮蔽实现里用到的全局 `fetch`。
 */
import { cnkiPlugin } from "./plugin.js";

export const fetch = cnkiPlugin;

export { cnkiPlugin, endpoints, policy } from "./plugin.js";
