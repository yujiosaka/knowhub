import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { TestLogger } from "../../../src/logger.js";
import { LocalPlugin } from "../../../src/plugins/builtin/local.js";
import {
  PluginConfigurationError,
  PluginError,
} from "../../../src/plugins/errors.js";
import type { PluginContext } from "../../../src/plugins/types.js";
import { TestEnvironment } from "../../helpers/test-utils.js";

describe("LocalPlugin", () => {
  let testEnv: TestEnvironment;
  let plugin: LocalPlugin;
  let context: PluginContext;

  beforeEach(async () => {
    testEnv = new TestEnvironment("local-plugin");
    await testEnv.setup();
    plugin = new LocalPlugin();
    context = {
      projectRoot: testEnv.tempDir,
      logger: new TestLogger(),
    };
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe("metadata", () => {
    it("has correct plugin name", () => {
      expect(plugin.name).toBe("local");
    });

    it("has correct version", () => {
      expect(plugin.version).toBe("1.0.0");
    });

    it("has descriptive description", () => {
      expect(plugin.description).toContain("local filesystem");
      expect(plugin.description).toContain("files");
      expect(plugin.description).toContain("directories");
    });

    it("has valid schema", () => {
      expect(plugin.schema).toBeDefined();
      expect(plugin.schema.type).toBe("object");
      expect(plugin.schema.required).toContain("path");
      expect(plugin.schema.properties).toBeDefined();
      expect(plugin.schema.properties?.path).toBeDefined();
      expect(plugin.schema.properties?.symlink).toBeDefined();
      expect(plugin.schema.additionalProperties).toBe(false);
    });
  });

  describe("validation", () => {
    it("validates valid config with file path", async () => {
      const config = { path: "./test.txt" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates valid config with directory path", async () => {
      const config = { path: "./test-dir" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates config with symlink option true", async () => {
      const config = { path: "./test.txt", symlink: true };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates config with symlink option false", async () => {
      const config = { path: "./test.txt", symlink: false };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates config with absolute path", async () => {
      const config = { path: "/absolute/path/test.txt" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates config with complex relative path", async () => {
      const config = { path: "../parent/nested/file.txt" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("throws error for missing config", async () => {
      await expect(plugin.validate(undefined)).rejects.toThrow(
        PluginConfigurationError,
      );
    });

    it("throws error for null config", async () => {
      await expect(plugin.validate(null)).rejects.toThrow(
        PluginConfigurationError,
      );
    });

    it("throws error for non-object config", async () => {
      await expect(plugin.validate("string")).rejects.toThrow(
        PluginConfigurationError,
      );
      await expect(plugin.validate(123)).rejects.toThrow(
        PluginConfigurationError,
      );
      await expect(plugin.validate([])).rejects.toThrow(
        PluginConfigurationError,
      );
    });

    it("throws error for missing path", async () => {
      const config = {};
      const error = await plugin.validate(config).catch((e) => e);
      expect(error).toBeInstanceOf(PluginConfigurationError);
      expect(error.message).toContain("path");
      expect(error.message).toContain("non-empty string");
    });

    it("throws error for empty path", async () => {
      const config = { path: "" };
      const error = await plugin.validate(config).catch((e) => e);
      expect(error).toBeInstanceOf(PluginConfigurationError);
      expect(error.message).toContain("path");
      expect(error.message).toContain("non-empty string");
    });

    it("throws error for non-string path", async () => {
      const configs = [
        { path: 123 },
        { path: true },
        { path: [] },
        { path: {} },
        { path: null },
      ];

      for (const config of configs) {
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("path");
        expect(error.message).toContain("non-empty string");
      }
    });

    it("includes plugin name in error messages", async () => {
      const error = await plugin.validate({ path: "" }).catch((e) => e);
      expect(error.message).toContain("local");
    });
  });

  describe("fetch - files", () => {
    it("fetches existing file with correct metadata", async () => {
      const content = "Test file content";
      await testEnv.createFile("test.txt", content);
      const config = { path: "./test.txt" };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain("test.txt");
      expect(result.isDirectory).toBe(false);
      expect(result.content).toBeUndefined();
      expect(result.metadata?.symlink).toBe(false);
      expect(result.metadata?.lastModified).toBeInstanceOf(Date);
      expect(result.metadata?.version).toBeDefined();
    });

    it("fetches file with symlink metadata when specified", async () => {
      await testEnv.createFile("test.txt", "content");
      const config = { path: "./test.txt", symlink: true };

      const result = await plugin.fetch(config, context);

      expect(result.metadata?.symlink).toBe(true);
    });

    it("resolves absolute paths correctly", async () => {
      await testEnv.createFile("test.txt", "content");
      const absolutePath = testEnv.path("test.txt");
      const config = { path: absolutePath };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toBe(absolutePath);
      expect(result.isDirectory).toBe(false);
    });

    it("resolves relative paths from project root", async () => {
      await testEnv.createFile("nested/test.txt", "content");
      const config = { path: "./nested/test.txt" };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain("nested/test.txt");
      expect(result.isDirectory).toBe(false);
    });
  });

  describe("fetch - directories", () => {
    it("fetches existing directory with correct metadata", async () => {
      await testEnv.createDirectory("test-dir");
      const config = { path: "./test-dir" };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain("test-dir");
      expect(result.isDirectory).toBe(true);
      expect(result.content).toBeUndefined();
      expect(result.metadata?.symlink).toBe(false);
      expect(result.metadata?.lastModified).toBeInstanceOf(Date);
    });

    it("fetches directory with symlink metadata when specified", async () => {
      await testEnv.createDirectory("test-dir");
      const config = { path: "./test-dir", symlink: true };

      const result = await plugin.fetch(config, context);

      expect(result.metadata?.symlink).toBe(true);
    });

    it("fetches nested directory structure", async () => {
      await testEnv.createDirectory("parent/child/grandchild");
      const config = { path: "./parent" };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain("parent");
      expect(result.isDirectory).toBe(true);
    });
  });

  describe("error handling", () => {
    it("throws PluginError for non-existent file", async () => {
      const config = { path: "./non-existent.txt" };

      const error = await plugin.fetch(config, context).catch((e) => e);
      expect(error).toBeInstanceOf(PluginError);
      expect(error.message).toContain("non-existent.txt");
      expect(error.pluginName).toBe("local");
    });

    it("throws PluginError for non-existent directory", async () => {
      const config = { path: "./non-existent-dir" };

      const error = await plugin.fetch(config, context).catch((e) => e);
      expect(error).toBeInstanceOf(PluginError);
      expect(error.message).toContain("non-existent-dir");
    });

    it("validates config before fetching", async () => {
      const config = { path: "" };

      const error = await plugin.fetch(config, context).catch((e) => e);
      expect(error).toBeInstanceOf(PluginConfigurationError);
    });

    it("includes original error in PluginError cause", async () => {
      const config = { path: "./non-existent.txt" };

      const error = await plugin.fetch(config, context).catch((e) => e);
      expect(error).toBeInstanceOf(PluginError);
      expect(error.cause).toBeInstanceOf(Error);
    });
  });

  describe("edge cases", () => {
    it("handles paths with special characters", async () => {
      const fileName = "test file with spaces & symbols.txt";
      await testEnv.createFile(fileName, "content");
      const config = { path: `./${fileName}` };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain(fileName);
      expect(result.isDirectory).toBe(false);
    });

    it("handles Unicode file names", async () => {
      const fileName = "测试文件.txt";
      await testEnv.createFile(fileName, "content");
      const config = { path: `./${fileName}` };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain(fileName);
      expect(result.isDirectory).toBe(false);
    });

    it("handles empty directory", async () => {
      await testEnv.createDirectory("empty-dir");
      const config = { path: "./empty-dir" };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain("empty-dir");
      expect(result.isDirectory).toBe(true);
    });

    it("handles deeply nested paths", async () => {
      const deepPath = "a/b/c/d/e/f/g/deep.txt";
      await testEnv.createFile(deepPath, "deep content");
      const config = { path: `./${deepPath}` };

      const result = await plugin.fetch(config, context);

      expect(result.localPath).toContain(deepPath);
      expect(result.isDirectory).toBe(false);
    });
  });
});
