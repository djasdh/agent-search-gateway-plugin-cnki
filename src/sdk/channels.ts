/** 抓取通道契约（与网关结构一致）与 CNKI 通道常量。 */

import type { Logger } from "./logger.js";
import type { FetchPluginSecrets, FetchPluginSettings } from "./settings.js";

export type FetchChannelKind = "cli" | "http" | "session";

export interface ChannelProbe {
  ok: boolean;
  version?: string;
  authenticated?: boolean;
  message?: string;
}

export interface ChannelContext {
  settings: FetchPluginSettings;
  secrets: FetchPluginSecrets;
  getSecret(path: string): string | undefined;
  logger?: Logger;
}

export interface FetchChannel {
  id: string;
  platform: string;
  channel: string;
  displayName: string;
  kind: FetchChannelKind;
  capabilities: readonly string[];
  aliases?: readonly string[];
  probe?(ctx: ChannelContext): Promise<ChannelProbe>;
  dispose?(): Promise<void>;
}

export const CNKI_HTTP: FetchChannel = {
  id: "cnki:http",
  platform: "cnki",
  channel: "http",
  displayName: "CNKI HTTP",
  kind: "http",
  capabilities: ["pdf"],
  aliases: ["cnki"],
};
