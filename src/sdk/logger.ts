/**
 * 宿主 logger 的结构化类型（只依赖方法签名，不依赖宿主实现）。
 *
 * 网关传入的是自己的 `Logger` 实例，结构上与这里兼容；插件只调用 `debug`，
 * 其余方法保留给可能的扩展。
 */
export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  close?(): void;
}
