import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { TestLogger } from "../../src/logger.js";
import { HttpPlugin } from "../../src/plugins/builtin/http.js";
import { LocalPlugin } from "../../src/plugins/builtin/local.js";
import { PluginNotFoundError } from "../../src/plugins/errors.js";
import { PluginRegistry } from "../../src/plugins/registry.js";
import type { Plugin, PluginContext } from "../../src/plugins/types.js";
import { TestEnvironment } from "../helpers/test-utils.js";

class MockPlugin implements Plugin {
  public name = "mock";
  public version = "1.0.0";
  public description = "Mock plugin for testing";
  public schema = {
    type: "object" as const,
    properties: {
      value: { type: "string" },
    },
    required: ["value"],
    additionalProperties: false,
  };

  async validate(): Promise<void> {
    // Mock validation
  }

  async fetch() {
    return {
      content: "Mock content",
      isDirectory: false,
    };
  }
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe("registration", () => {
    it("registers a plugin", () => {
      const plugin = new MockPlugin();
      registry.register(plugin);

      expect(registry.has("mock")).toBe(true);
      expect(registry.resolve("mock")).toBe(plugin);
    });

    it("registers multiple plugins", () => {
      const mockPlugin = new MockPlugin();
      const localPlugin = new LocalPlugin();
      const httpPlugin = new HttpPlugin();

      registry.register(mockPlugin);
      registry.register(localPlugin);
      registry.register(httpPlugin);

      expect(registry.has("mock")).toBe(true);
      expect(registry.has("local")).toBe(true);
      expect(registry.has("http")).toBe(true);
    });

    it("allows overwriting existing plugins", () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new MockPlugin();
      plugin2.version = "2.0.0";

      registry.register(plugin1);
      expect(registry.resolve("mock").version).toBe("1.0.0");

      registry.register(plugin2);
      expect(registry.resolve("mock").version).toBe("2.0.0");
    });

    it("tracks registry size correctly", () => {
      expect(registry.size()).toBe(0);

      registry.register(new MockPlugin());
      expect(registry.size()).toBe(1);

      registry.register(new LocalPlugin());
      expect(registry.size()).toBe(2);

      registry.register(new HttpPlugin());
      expect(registry.size()).toBe(3);
    });
  });

  describe("retrieval", () => {
    beforeEach(() => {
      registry.register(new MockPlugin());
      registry.register(new LocalPlugin());
      registry.register(new HttpPlugin());
    });

    it("retrieves registered plugin", () => {
      const plugin = registry.resolve("mock");
      expect(plugin).toBeInstanceOf(MockPlugin);
      expect(plugin.name).toBe("mock");
    });

    it("throws error for unregistered plugin", () => {
      expect(() => registry.resolve("nonexistent")).toThrow(
        PluginNotFoundError,
      );
    });

    it("checks plugin existence", () => {
      expect(registry.has("mock")).toBe(true);
      expect(registry.has("local")).toBe(true);
      expect(registry.has("http")).toBe(true);
      expect(registry.has("nonexistent")).toBe(false);
    });

    it("gets all registered plugins", () => {
      const plugins = registry.getAll();
      expect(plugins).toHaveLength(3);
      expect(plugins.some((p) => p.name === "mock")).toBe(true);
      expect(plugins.some((p) => p.name === "local")).toBe(true);
      expect(plugins.some((p) => p.name === "http")).toBe(true);
    });
  });

  describe("listing", () => {
    it("lists empty registry", () => {
      const names = registry.listAvailable();
      expect(names).toEqual([]);
    });

    it("lists registered plugins", () => {
      registry.register(new MockPlugin());
      registry.register(new LocalPlugin());
      registry.register(new HttpPlugin());

      const names = registry.listAvailable();
      expect(names).toContain("mock");
      expect(names).toContain("local");
      expect(names).toContain("http");
      expect(names).toHaveLength(3);
    });

    it("lists plugins in sorted order", () => {
      const plugins = [new HttpPlugin(), new MockPlugin(), new LocalPlugin()];

      for (const plugin of plugins) {
        registry.register(plugin);
      }

      const names = registry.listAvailable();
      expect(names).toEqual(["http", "local", "mock"]);
    });

    it("handles plugin replacement in listing", () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new MockPlugin();
      plugin2.version = "2.0.0";

      registry.register(plugin1);
      registry.register(new LocalPlugin());
      registry.register(plugin2);

      const names = registry.listAvailable();
      expect(names).toEqual(["local", "mock"]);
      expect(names).toHaveLength(2);
    });
  });

  describe("unregistration", () => {
    beforeEach(() => {
      registry.register(new MockPlugin());
      registry.register(new LocalPlugin());
      registry.register(new HttpPlugin());
    });

    it("unregisters existing plugin", () => {
      expect(registry.has("mock")).toBe(true);
      expect(registry.size()).toBe(3);

      const result = registry.unregister("mock");

      expect(result).toBe(true);
      expect(registry.has("mock")).toBe(false);
      expect(registry.size()).toBe(2);
    });

    it("returns false for non-existent plugin", () => {
      const result = registry.unregister("nonexistent");

      expect(result).toBe(false);
      expect(registry.size()).toBe(3);
    });

    it("allows re-registration after unregistration", () => {
      registry.unregister("mock");
      expect(registry.has("mock")).toBe(false);

      const newPlugin = new MockPlugin();
      newPlugin.version = "2.0.0";
      registry.register(newPlugin);

      expect(registry.has("mock")).toBe(true);
      expect(registry.resolve("mock").version).toBe("2.0.0");
    });
  });

  describe("clearing", () => {
    beforeEach(() => {
      registry.register(new MockPlugin());
      registry.register(new LocalPlugin());
      registry.register(new HttpPlugin());
    });

    it("clears all plugins", () => {
      expect(registry.size()).toBe(3);
      expect(registry.listAvailable()).toHaveLength(3);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.listAvailable()).toHaveLength(0);
      expect(registry.has("mock")).toBe(false);
      expect(registry.has("local")).toBe(false);
      expect(registry.has("http")).toBe(false);
    });

    it("allows registration after clearing", () => {
      registry.clear();
      expect(registry.size()).toBe(0);

      const plugin = new MockPlugin();
      registry.register(plugin);

      expect(registry.size()).toBe(1);
      expect(registry.has("mock")).toBe(true);
      expect(registry.resolve("mock")).toBe(plugin);
    });
  });

  describe("edge cases", () => {
    it("handles plugin with same name but different instance", () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new MockPlugin();
      plugin2.description = "Different description";

      registry.register(plugin1);
      expect(registry.resolve("mock").description).toBe(
        "Mock plugin for testing",
      );

      registry.register(plugin2);
      expect(registry.resolve("mock").description).toBe(
        "Different description",
      );
    });

    it("handles concurrent registrations", () => {
      const plugin1 = new MockPlugin();
      const plugin2 = new LocalPlugin();
      const plugin3 = new HttpPlugin();

      registry.register(plugin1);
      registry.register(plugin2);
      registry.register(plugin3);

      expect(registry.has("mock")).toBe(true);
      expect(registry.has("local")).toBe(true);
      expect(registry.has("http")).toBe(true);
    });

    it("handles plugin with empty name", () => {
      class EmptyNamePlugin implements Plugin {
        public name = "";
        public version = "1.0.0";
        public description = "Plugin with empty name";
        public schema = { type: "object" as const };

        async validate(): Promise<void> {}
        async fetch() {
          return { content: "", isDirectory: false };
        }
      }

      const plugin = new EmptyNamePlugin();
      registry.register(plugin);

      expect(registry.has("")).toBe(true);
      expect(registry.resolve("")).toBe(plugin);
    });

    it("handles null/undefined plugin names gracefully", () => {
      expect(registry.has("")).toBe(false);
      expect(() => registry.resolve("")).toThrow(PluginNotFoundError);
    });
  });

  describe("error handling", () => {
    it("throws PluginNotFoundError with correct message", () => {
      try {
        registry.resolve("missing");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginNotFoundError);
        expect((error as PluginNotFoundError).message).toContain("missing");
      }
    });

    it("throws PluginNotFoundError for empty registry", () => {
      try {
        registry.resolve("any");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginNotFoundError);
        expect((error as PluginNotFoundError).message).toContain("any");
      }
    });

    it("handles resolve error after unregistration", () => {
      registry.register(new MockPlugin());
      registry.unregister("mock");

      try {
        registry.resolve("mock");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginNotFoundError);
      }
    });

    it("handles resolve error after clearing", () => {
      registry.register(new MockPlugin());
      registry.clear();

      try {
        registry.resolve("mock");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginNotFoundError);
      }
    });
  });

  describe("integration with built-in plugins", () => {
    it("works with LocalPlugin", () => {
      const plugin = new LocalPlugin();
      registry.register(plugin);

      expect(registry.has("local")).toBe(true);
      expect(registry.resolve("local")).toBe(plugin);
      expect(registry.resolve("local").name).toBe("local");
    });

    it("works with HttpPlugin", () => {
      const plugin = new HttpPlugin();
      registry.register(plugin);

      expect(registry.has("http")).toBe(true);
      expect(registry.resolve("http")).toBe(plugin);
      expect(registry.resolve("http").name).toBe("http");
    });

    it("lists built-in plugins correctly", () => {
      registry.register(new LocalPlugin());
      registry.register(new HttpPlugin());

      const names = registry.listAvailable();
      expect(names).toEqual(["http", "local"]);
    });

    it("gets all built-in plugins correctly", () => {
      const local = new LocalPlugin();
      const http = new HttpPlugin();

      registry.register(local);
      registry.register(http);

      const plugins = registry.getAll();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(local);
      expect(plugins).toContain(http);
    });
  });

  describe("dynamic plugin loading", () => {
    let testEnv: TestEnvironment;
    let originalCwd: string;

    beforeEach(async () => {
      originalCwd = process.cwd();
      testEnv = new TestEnvironment("plugin-registry-dynamic");
      await testEnv.setup();
      process.chdir(testEnv.tempDir);
    });

    afterEach(async () => {
      try {
        process.chdir(originalCwd);
      } catch (error) {
        // Directory may have been cleaned up, ignore the error
      }
      await testEnv.cleanup();
    });

    it("loads plugin with default export class", async () => {
      const pluginContent = `
        export default class TestPlugin {
          name = "test-default";
          version = "1.0.0";
          description = "Test plugin with default export";
          
          async fetch() {
            return { content: "test content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("test-plugin.js", pluginContent);

      expect(registry.has("test-default")).toBe(false);

      await registry.loadPlugin("./test-plugin.js", testEnv.tempDir);

      expect(registry.has("test-default")).toBe(true);
      const plugin = registry.resolve("test-default");
      expect(plugin.name).toBe("test-default");
      expect(plugin.version).toBe("1.0.0");
    });

    it("loads plugin with default export instance", async () => {
      const pluginContent = `
        class TestPlugin {
          name = "test-instance";
          version = "2.0.0";
          description = "Test plugin with default instance export";
          
          async fetch() {
            return { content: "test content", isDirectory: false };
          }
        }
        
        export default new TestPlugin();
      `;

      await testEnv.createFile("test-plugin-instance.js", pluginContent);

      await registry.loadPlugin("./test-plugin-instance.js", testEnv.tempDir);

      expect(registry.has("test-instance")).toBe(true);
      const plugin = registry.resolve("test-instance");
      expect(plugin.name).toBe("test-instance");
      expect(plugin.version).toBe("2.0.0");
    });

    it("loads plugin with named export class", async () => {
      const pluginContent = `
        export class TestNamedPlugin {
          name = "test-named";
          version = "3.0.0";
          description = "Test plugin with named export";
          
          async fetch() {
            return { content: "test content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("test-named-plugin.js", pluginContent);

      await registry.loadPlugin("./test-named-plugin.js", testEnv.tempDir);

      expect(registry.has("test-named")).toBe(true);
      const plugin = registry.resolve("test-named");
      expect(plugin.name).toBe("test-named");
      expect(plugin.version).toBe("3.0.0");
    });

    it("loads plugin with named export instance", async () => {
      const pluginContent = `
        class TestPlugin {
          name = "test-named-instance";
          version = "4.0.0";
          description = "Test plugin with named instance export";
          
          async fetch() {
            return { content: "test content", isDirectory: false };
          }
        }
        
        export const testPlugin = new TestPlugin();
      `;

      await testEnv.createFile("test-named-instance.js", pluginContent);

      await registry.loadPlugin("./test-named-instance.js", testEnv.tempDir);

      expect(registry.has("test-named-instance")).toBe(true);
      const plugin = registry.resolve("test-named-instance");
      expect(plugin.name).toBe("test-named-instance");
      expect(plugin.version).toBe("4.0.0");
    });

    it("throws error for non-existent plugin file", async () => {
      await expect(
        registry.loadPlugin("./non-existent.js", testEnv.tempDir),
      ).rejects.toThrow("Failed to load plugin from ./non-existent.js");
    });

    it("throws error for invalid plugin format", async () => {
      const invalidContent = `
        export const notAPlugin = "this is not a plugin";
        export const alsoNotAPlugin = 42;
      `;

      await testEnv.createFile("invalid-plugin.js", invalidContent);

      await expect(
        registry.loadPlugin("./invalid-plugin.js", testEnv.tempDir),
      ).rejects.toThrow("No valid plugin found in ./invalid-plugin.js");
    });

    it("throws error for plugin without required interface", async () => {
      const incompleteContent = `
        export default class IncompletePlugin {
          name = "incomplete";
          version = "1.0.0";
          // Missing fetch method
        }
      `;

      await testEnv.createFile("incomplete-plugin.js", incompleteContent);

      await expect(
        registry.loadPlugin("./incomplete-plugin.js", testEnv.tempDir),
      ).rejects.toThrow("No valid plugin found in ./incomplete-plugin.js");
    });

    it("loads multiple plugins at once", async () => {
      const plugin1Content = `
        export default class Plugin1 {
          name = "plugin-1";
          version = "1.0.0";
          description = "First test plugin";
          
          async fetch() {
            return { content: "plugin 1 content", isDirectory: false };
          }
        }
      `;

      const plugin2Content = `
        export default class Plugin2 {
          name = "plugin-2";
          version = "1.0.0";
          description = "Second test plugin";
          
          async fetch() {
            return { content: "plugin 2 content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("plugin1.js", plugin1Content);
      await testEnv.createFile("plugin2.js", plugin2Content);

      expect(registry.has("plugin-1")).toBe(false);
      expect(registry.has("plugin-2")).toBe(false);

      await registry.loadPlugins(
        ["./plugin1.js", "./plugin2.js"],
        testEnv.tempDir,
      );

      expect(registry.has("plugin-1")).toBe(true);
      expect(registry.has("plugin-2")).toBe(true);
      expect(registry.listAvailable()).toContain("plugin-1");
      expect(registry.listAvailable()).toContain("plugin-2");
    });

    it("stops loading plugins on first error in loadPlugins", async () => {
      const validContent = `
        export default class ValidPlugin {
          name = "valid-plugin";
          version = "1.0.0";
          description = "Valid test plugin";
          
          async fetch() {
            return { content: "valid content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("valid-plugin.js", validContent);

      await expect(
        registry.loadPlugins(
          ["./valid-plugin.js", "./non-existent.js"],
          testEnv.tempDir,
        ),
      ).rejects.toThrow("Failed to load plugin from ./non-existent.js");

      expect(registry.has("valid-plugin")).toBe(true);
    });

    it("resolves plugin paths relative to project root", async () => {
      await testEnv.createDirectory("plugins");

      const nestedPluginContent = `
        export default class NestedPlugin {
          name = "nested-plugin";
          version = "1.0.0";
          description = "Plugin in nested directory";
          
          async fetch() {
            return { content: "nested content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("plugins/nested-plugin.js", nestedPluginContent);

      await registry.loadPlugin("./plugins/nested-plugin.js", testEnv.tempDir);

      expect(registry.has("nested-plugin")).toBe(true);
      const plugin = registry.resolve("nested-plugin");
      expect(plugin.name).toBe("nested-plugin");
    });

    it("loads and registers functional plugin", async () => {
      const functionalContent = `
        export default class FunctionalPlugin {
          name = "functional";
          version = "1.0.0";
          description = "Fully functional test plugin";
          schema = {
            type: "object",
            properties: {
              message: { type: "string" }
            },
            required: ["message"]
          };
          
          async validate(config) {
            if (!config || typeof config.message !== "string") {
              throw new Error("Invalid config");
            }
          }
          
          async fetch(config, context) {
            return {
              content: \`Functional plugin: \${config.message}\`,
              isDirectory: false,
              metadata: {
                pluginName: this.name,
                version: this.version
              }
            };
          }
        }
      `;

      await testEnv.createFile("functional-plugin.js", functionalContent);

      await registry.loadPlugin("./functional-plugin.js", testEnv.tempDir);

      const plugin = registry.resolve("functional");
      expect(plugin.name).toBe("functional");

      const config = { message: "Hello from dynamic plugin!" };
      const context = {
        projectRoot: testEnv.tempDir,
        logger: new TestLogger(),
      };

      if (plugin.validate) {
        await plugin.validate(config);
      }
      const result = await plugin.fetch(config, context);

      expect(result.content).toBe(
        "Functional plugin: Hello from dynamic plugin!",
      );
      expect(result.isDirectory).toBe(false);
      expect(result.metadata?.pluginName).toBe("functional");
      expect(result.metadata?.version).toBe("1.0.0");
    });
  });
});
