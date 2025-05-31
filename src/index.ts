import "./plugins/index.js";

export type { Config, Resource } from "./config.js";
export type {
  Plugin,
  PluginContext,
  PluginResult,
  PluginMetadata,
  PluginConfigSchema,
  HttpPluginConfig,
  LocalPluginConfig,
} from "./plugins/index.js";
export { pluginRegistry } from "./plugins/index.js";
export { LocalPlugin, HttpPlugin } from "./plugins/index.js";
