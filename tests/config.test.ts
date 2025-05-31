import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { loadConfig } from "../src/config.js";
import { ConfigurationError, ValidationError } from "../src/errors.js";
import { HttpPlugin } from "../src/plugins/builtin/http.js";
import { LocalPlugin } from "../src/plugins/builtin/local.js";
import { pluginRegistry } from "../src/plugins/registry.js";
import { TestEnvironment } from "./helpers/test-utils.js";

describe("loadConfig", () => {
  let testEnv: TestEnvironment;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  beforeEach(async () => {
    testEnv = new TestEnvironment("load-config");
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

    pluginRegistry.clear();
    pluginRegistry.register(new LocalPlugin());
    pluginRegistry.register(new HttpPlugin());
  });

  it("load valid JSON config", async () => {
    await testEnv.createFile("test-file.txt", "test content");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./test-file.txt" },
          overwrite: true,
          outputs: ["output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    const resources = await loadConfig();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.plugin).toBe("local");
    expect(resources[0]?.pluginConfig).toEqual({ path: "./test-file.txt" });
    expect(resources[0]?.overwrite).toBe(true);
    expect(resources[0]?.outputs).toEqual(["output.txt"]);
  });

  it("load config with URL resource", async () => {
    const config = {
      resources: [
        {
          plugin: "http",
          pluginConfig: { url: "https://example.com/file.txt" },
          symlink: false,
          overwrite: false,
          outputs: ["remote-file.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    const resources = await loadConfig();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.plugin).toBe("http");
    expect(resources[0]?.pluginConfig).toEqual({
      url: "https://example.com/file.txt",
    });
    expect(resources[0]?.overwrite).toBe(false);
    expect(resources[0]?.outputs).toEqual(["remote-file.txt"]);
  });

  it("apply default values", async () => {
    await testEnv.createFile("test-file.txt", "test content");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./test-file.txt" },
          outputs: ["output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    const resources = await loadConfig();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.overwrite).toBe(true);
  });

  it("handle multiple resources", async () => {
    await testEnv.createFile("file1.txt", "content1");
    await testEnv.createFile("file2.txt", "content2");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./file1.txt" },
          outputs: ["output1.txt"],
        },
        {
          plugin: "local",
          pluginConfig: { path: "./file2.txt", symlink: true },
          outputs: ["output2.txt"],
        },
        {
          plugin: "http",
          pluginConfig: { url: "https://example.com/remote.txt" },
          outputs: ["remote.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    const resources = await loadConfig();
    expect(resources).toHaveLength(3);
    expect(resources[0]?.plugin).toBe("local");
    expect(resources[0]?.pluginConfig).toEqual({ path: "./file1.txt" });
    expect(resources[1]?.plugin).toBe("local");
    expect(resources[1]?.pluginConfig).toEqual({
      path: "./file2.txt",
      symlink: true,
    });
    expect(resources[2]?.plugin).toBe("http");
    expect(resources[2]?.pluginConfig).toEqual({
      url: "https://example.com/remote.txt",
    });
  });

  it("load config from specific path", async () => {
    await testEnv.createFile("test-file.txt", "test content");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./test-file.txt" },
          outputs: ["output.txt"],
        },
      ],
    };

    const configPath = await testEnv.createConfig(config, "custom-config.json");

    const resources = await loadConfig(configPath);
    expect(resources).toHaveLength(1);
    expect(resources[0]?.plugin).toBe("local");
    expect(resources[0]?.pluginConfig).toEqual({ path: "./test-file.txt" });
  });

  it("load YAML config", async () => {
    await testEnv.createFile("test-file.txt", "test content");

    const yamlContent = `
resources:
  - plugin: local
    pluginConfig:
      path: ./test-file.txt
    outputs:
      - output.txt
`;

    await testEnv.createFile(".knowhubrc.yaml", yamlContent);

    const resources = await loadConfig();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.plugin).toBe("local");
    expect(resources[0]?.pluginConfig).toEqual({ path: "./test-file.txt" });
  });

  it("load config from package.json", async () => {
    await testEnv.createFile("test-file.txt", "test content");

    const packageJson = {
      name: "test-package",
      knowhub: {
        resources: [
          {
            plugin: "local",
            pluginConfig: { path: "./test-file.txt" },
            outputs: ["output.txt"],
          },
        ],
      },
    };

    await testEnv.createFile(
      "package.json",
      JSON.stringify(packageJson, null, 2),
    );

    const resources = await loadConfig();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.plugin).toBe("local");
    expect(resources[0]?.pluginConfig).toEqual({ path: "./test-file.txt" });
  });

  it("throw error when no config found", async () => {
    await expect(loadConfig()).rejects.toThrow(ConfigurationError);
  });

  it("throw error for invalid config structure", async () => {
    const invalidConfig = {
      notResources: "invalid",
    };

    await testEnv.createConfig(invalidConfig, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ConfigurationError);
  });

  it("throw error for empty resources array", async () => {
    const config = {
      resources: [],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ConfigurationError);
  });

  it("throw error for invalid resource", async () => {
    const config = {
      resources: [
        {
          plugin: "local",
          outputs: ["output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ValidationError);
  });

  it("load config with non-existent local file (validation happens at runtime)", async () => {
    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./non-existent.txt" },
          outputs: ["output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    const resources = await loadConfig();
    expect(resources).toHaveLength(1);
    expect(resources[0]?.plugin).toBe("local");
  });

  it("throw error for invalid URL", async () => {
    const config = {
      resources: [
        {
          plugin: "http",
          pluginConfig: { url: "not-a-valid-url" },
          outputs: ["output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ValidationError);
  });

  it("throw error for invalid overwrite value", async () => {
    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./test.txt" },
          overwrite: "invalid",
          outputs: ["output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ValidationError);
  });

  it("throw error for invalid outputs", async () => {
    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./test.txt" },
          outputs: [],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ValidationError);
  });

  it("handle malformed JSON gracefully", async () => {
    await testEnv.createFile(".knowhubrc.json", '{"resources": [}');

    await expect(loadConfig()).rejects.toThrow();
  });

  it("handle null resource in array", async () => {
    const config = {
      resources: [null],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ValidationError);
  });

  it("validate resources with both symlink and copy modes", async () => {
    await testEnv.createFile("file1.txt", "content1");
    await testEnv.createFile("file2.txt", "content2");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./file1.txt", symlink: false },
          outputs: ["copy-output.txt"],
        },
        {
          plugin: "local",
          pluginConfig: { path: "./file2.txt", symlink: true },
          outputs: ["symlink-output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    const resources = await loadConfig();
    expect(resources).toHaveLength(2);
    expect(resources[0]?.pluginConfig).toEqual({
      path: "./file1.txt",
      symlink: false,
    });
    expect(resources[1]?.pluginConfig).toEqual({
      path: "./file2.txt",
      symlink: true,
    });
  });

  it("throw error for unknown plugin", async () => {
    const config = {
      resources: [
        {
          plugin: "unknown",
          pluginConfig: { something: "value" },
          outputs: ["output.txt"],
        },
      ],
    };

    await testEnv.createConfig(config, ".knowhubrc.json");

    await expect(loadConfig()).rejects.toThrow(ValidationError);
  });

  describe("dynamic plugin loading", () => {
    it("loads config without plugins field", async () => {
      await testEnv.createFile("test-file.txt", "test content");

      const config = {
        resources: [
          {
            plugin: "local",
            pluginConfig: { path: "./test-file.txt" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      const resources = await loadConfig(undefined, testEnv.tempDir);
      expect(resources).toHaveLength(1);
      expect(resources[0]?.plugin).toBe("local");
    });

    it("loads config with empty plugins array", async () => {
      await testEnv.createFile("test-file.txt", "test content");

      const config = {
        plugins: [],
        resources: [
          {
            plugin: "local",
            pluginConfig: { path: "./test-file.txt" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      const resources = await loadConfig(undefined, testEnv.tempDir);
      expect(resources).toHaveLength(1);
      expect(resources[0]?.plugin).toBe("local");
    });

    it("loads config with valid plugin", async () => {
      await testEnv.createFile("test-file.txt", "test content");

      const pluginContent = `
        export default class TestPlugin {
          name = "test-plugin";
          version = "1.0.0";
          description = "Test plugin for config loading";
          
          async fetch() {
            return { content: "test content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("test-plugin.js", pluginContent);

      const config = {
        plugins: ["./test-plugin.js"],
        resources: [
          {
            plugin: "test-plugin",
            pluginConfig: { message: "hello" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      const resources = await loadConfig(undefined, testEnv.tempDir);
      expect(resources).toHaveLength(1);
      expect(resources[0]?.plugin).toBe("test-plugin");

      expect(pluginRegistry.has("test-plugin")).toBe(true);
      const plugin = pluginRegistry.resolve("test-plugin");
      expect(plugin.name).toBe("test-plugin");
      expect(plugin.version).toBe("1.0.0");
    });

    it("loads config with multiple plugins", async () => {
      await testEnv.createFile("test-file.txt", "test content");

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

      const config = {
        plugins: ["./plugin1.js", "./plugin2.js"],
        resources: [
          {
            plugin: "plugin-1",
            pluginConfig: { message: "hello" },
            outputs: ["output1.txt"],
          },
          {
            plugin: "plugin-2",
            pluginConfig: { message: "world" },
            outputs: ["output2.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      const resources = await loadConfig(undefined, testEnv.tempDir);
      expect(resources).toHaveLength(2);

      expect(pluginRegistry.has("plugin-1")).toBe(true);
      expect(pluginRegistry.has("plugin-2")).toBe(true);
      expect(pluginRegistry.listAvailable()).toContain("plugin-1");
      expect(pluginRegistry.listAvailable()).toContain("plugin-2");
    });

    it("throws error for non-existent plugin file", async () => {
      const config = {
        plugins: ["./non-existent-plugin.js"],
        resources: [
          {
            plugin: "local",
            pluginConfig: { path: "./test.txt" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      await expect(loadConfig(undefined, testEnv.tempDir)).rejects.toThrow(
        ConfigurationError,
      );
    });

    it("throws error for invalid plugin file", async () => {
      const invalidPluginContent = `
        export const notAPlugin = "this is not a plugin";
      `;

      await testEnv.createFile("invalid-plugin.js", invalidPluginContent);

      const config = {
        plugins: ["./invalid-plugin.js"],
        resources: [
          {
            plugin: "local",
            pluginConfig: { path: "./test.txt" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      await expect(loadConfig(undefined, testEnv.tempDir)).rejects.toThrow(
        ConfigurationError,
      );
    });

    it("throws error when plugin loading fails with invalid module", async () => {
      const syntaxErrorContent = `
        export default class SyntaxErrorPlugin {
          name = "syntax-error";
          version = "1.0.0";
          
          // Missing closing brace to cause syntax error
          async fetch() {
            return { content: "test", isDirectory: false };
      `;

      await testEnv.createFile("syntax-error-plugin.js", syntaxErrorContent);

      const config = {
        plugins: ["./syntax-error-plugin.js"],
        resources: [
          {
            plugin: "local",
            pluginConfig: { path: "./test.txt" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      await expect(loadConfig(undefined, testEnv.tempDir)).rejects.toThrow(
        ConfigurationError,
      );
    });

    it("loads plugin and makes it available for resource validation", async () => {
      const customPluginContent = `
        export default class CustomPlugin {
          name = "custom";
          version = "1.0.0";
          description = "Custom plugin for validation test";
          
          async validate(config) {
            if (!config || typeof config.requiredField !== "string") {
              throw new Error("requiredField is required and must be a string");
            }
          }
          
          async fetch() {
            return { content: "custom content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("custom-plugin.js", customPluginContent);

      const config = {
        plugins: ["./custom-plugin.js"],
        resources: [
          {
            plugin: "custom",
            pluginConfig: { requiredField: "valid-value" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      const resources = await loadConfig(undefined, testEnv.tempDir);
      expect(resources).toHaveLength(1);
      expect(resources[0]?.plugin).toBe("custom");
      expect(pluginRegistry.has("custom")).toBe(true);
    });

    it("handles plugin loading with nested directory structure", async () => {
      await testEnv.createDirectory("plugins");

      const nestedPluginContent = `
        export default class NestedPlugin {
          name = "nested";
          version = "1.0.0";
          description = "Plugin in nested directory";
          
          async fetch() {
            return { content: "nested content", isDirectory: false };
          }
        }
      `;

      await testEnv.createFile("plugins/nested-plugin.js", nestedPluginContent);

      const config = {
        plugins: ["./plugins/nested-plugin.js"],
        resources: [
          {
            plugin: "nested",
            pluginConfig: { message: "nested test" },
            outputs: ["output.txt"],
          },
        ],
      };

      await testEnv.createConfig(config, ".knowhubrc.json");

      const resources = await loadConfig(undefined, testEnv.tempDir);
      expect(resources).toHaveLength(1);
      expect(resources[0]?.plugin).toBe("nested");
      expect(pluginRegistry.has("nested")).toBe(true);
    });
  });
});
