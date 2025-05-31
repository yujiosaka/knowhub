import { resolve } from "node:path";
import { PluginNotFoundError } from "./errors.js";
import type { Plugin } from "./types.js";

/**
 * Registry for managing available plugins
 */
export class PluginRegistry {
  private plugins = new Map<string, Plugin>();

  /**
   * Register a plugin in the registry
   */
  register(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Resolve a plugin by name
   */
  resolve(name: string): Plugin {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new PluginNotFoundError(name);
    }
    return plugin;
  }

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get all registered plugin names
   */
  listAvailable(): string[] {
    return Array.from(this.plugins.keys()).sort();
  }

  /**
   * Get all registered plugins
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Unregister a plugin
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.plugins.clear();
  }

  /**
   * Get the number of registered plugins
   */
  size(): number {
    return this.plugins.size;
  }

  /**
   * Dynamically load and register a plugin from a file path
   */
  async loadPlugin(pluginPath: string, projectRoot: string): Promise<void> {
    try {
      const absolutePath = resolve(projectRoot, pluginPath);
      const pluginModule = await import(absolutePath);

      let pluginInstance: Plugin | undefined;
      if (pluginModule.default && typeof pluginModule.default === "function") {
        try {
          const instance = new pluginModule.default();
          if (instance.name && typeof instance.fetch === "function") {
            pluginInstance = instance;
          }
        } catch {
          // Not a valid plugin constructor
        }
      } else if (
        pluginModule.default &&
        typeof pluginModule.default === "object" &&
        pluginModule.default.name &&
        typeof pluginModule.default.fetch === "function"
      ) {
        pluginInstance = pluginModule.default;
      } else {
        for (const exportName of Object.keys(pluginModule)) {
          const exportValue = pluginModule[exportName];
          if (exportValue && typeof exportValue === "function") {
            try {
              const instance = new exportValue();
              if (instance.name && typeof instance.fetch === "function") {
                pluginInstance = instance;
                break;
              }
            } catch {}
          } else if (
            exportValue &&
            typeof exportValue === "object" &&
            exportValue.name &&
            typeof exportValue.fetch === "function"
          ) {
            pluginInstance = exportValue;
            break;
          }
        }
      }

      if (!pluginInstance) {
        throw new Error(
          `No valid plugin found in ${pluginPath}. Plugin must export a class or instance implementing the Plugin interface.`,
        );
      }

      this.register(pluginInstance);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to load plugin from ${pluginPath}: ${errorMessage}`,
      );
    }
  }

  /**
   * Load multiple plugins from file paths
   */
  async loadPlugins(pluginPaths: string[], projectRoot: string): Promise<void> {
    for (const pluginPath of pluginPaths) {
      await this.loadPlugin(pluginPath, projectRoot);
    }
  }
}

/**
 * Default global plugin registry
 */
export const pluginRegistry = new PluginRegistry();
