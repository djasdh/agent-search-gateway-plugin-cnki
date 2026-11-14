/** 插件可见的设置/密钥切片（与网关 `src/settings/*` 的 schema 结构一致）。 */

export interface FetchSettings {
  timeout_ms: number;
  max_bytes: number;
  user_agent: string;
  /** 非文本产物（PDF/图片）落盘上限；CNKI 用它限制单次下载。 */
  max_download_bytes: number;
}

export interface FetchPluginSettings {
  fetch: FetchSettings;
}

export interface FetchPluginSecrets {
  bilibili: { http: { token: string } };
}
