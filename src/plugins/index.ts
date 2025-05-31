import { plugins } from "./builtin/index.js";
import { pluginRegistry } from "./registry.js";

for (const plugin of plugins) {
  pluginRegistry.register(plugin);
}

export * from "./helpers.js";
export * from "./types.js";
export * from "./registry.js";
export * from "./builtin/index.js";
export { pluginRegistry };
