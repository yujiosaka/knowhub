import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { TestLogger } from "../src/logger.js";
import { HttpPlugin } from "../src/plugins/builtin/http.js";
import { LocalPlugin } from "../src/plugins/builtin/local.js";
import {
  PluginConfigurationError,
  PluginError,
} from "../src/plugins/errors.js";
import { pluginRegistry } from "../src/plugins/registry.js";
import type { PluginContext } from "../src/plugins/types.js";
import { TestEnvironment } from "./helpers/test-utils.js";

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

  it("has correct metadata", () => {
    expect(plugin.name).toBe("local");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.description).toContain("local filesystem");
    expect(plugin.schema).toBeDefined();
    expect(plugin.schema.required).toContain("path");
  });

  it("validates valid config", async () => {
    const config = { path: "./test.txt" };
    await expect(plugin.validate(config)).resolves.toBeUndefined();
  });

  it("validates config with symlink option", async () => {
    const config = { path: "./test.txt", symlink: true };
    await expect(plugin.validate(config)).resolves.toBeUndefined();
  });

  it("throws error for missing path", async () => {
    const config = {};
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for empty path", async () => {
    const config = { path: "" };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for non-string path", async () => {
    const config = { path: 123 };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for non-object config", async () => {
    await expect(plugin.validate("string")).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("fetches existing file", async () => {
    await testEnv.createFile("test.txt", "content");
    const config = { path: "./test.txt" };

    const result = await plugin.fetch(config, context);

    expect(result.localPath).toContain("test.txt");
    expect(result.isDirectory).toBe(false);
    expect(result.metadata?.symlink).toBe(false);
    expect(result.metadata?.lastModified).toBeInstanceOf(Date);
  });

  it("fetches existing directory", async () => {
    await testEnv.createDirectory("test-dir");
    const config = { path: "./test-dir" };

    const result = await plugin.fetch(config, context);

    expect(result.localPath).toContain("test-dir");
    expect(result.isDirectory).toBe(true);
    expect(result.metadata?.symlink).toBe(false);
  });

  it("includes symlink metadata when specified", async () => {
    await testEnv.createFile("test.txt", "content");
    const config = { path: "./test.txt", symlink: true };

    const result = await plugin.fetch(config, context);

    expect(result.metadata?.symlink).toBe(true);
  });

  it("throws PluginError for non-existent path", async () => {
    const config = { path: "./non-existent.txt" };

    await expect(plugin.fetch(config, context)).rejects.toThrow(PluginError);
  });

  it("validates config before fetching", async () => {
    const config = { path: "" };

    await expect(plugin.fetch(config, context)).rejects.toThrow(
      PluginConfigurationError,
    );
  });
});

describe("HttpPlugin", () => {
  let plugin: HttpPlugin;
  let context: PluginContext;

  beforeEach(() => {
    plugin = new HttpPlugin();
    context = {
      projectRoot: "/tmp",
      logger: new TestLogger(),
    };
  });

  it("has correct metadata", () => {
    expect(plugin.name).toBe("http");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.description).toContain("HTTP");
    expect(plugin.schema).toBeDefined();
    expect(plugin.schema.required).toContain("url");
  });

  it("validates valid HTTP URL", async () => {
    const config = { url: "http://example.com" };
    await expect(plugin.validate(config)).resolves.toBeUndefined();
  });

  it("validates valid HTTPS URL", async () => {
    const config = { url: "https://example.com" };
    await expect(plugin.validate(config)).resolves.toBeUndefined();
  });

  it("validates config with headers", async () => {
    const config = {
      url: "https://example.com",
      headers: { Authorization: "Bearer token" },
    };
    await expect(plugin.validate(config)).resolves.toBeUndefined();
  });

  it("validates config with timeout", async () => {
    const config = {
      url: "https://example.com",
      timeout: 5000,
    };
    await expect(plugin.validate(config)).resolves.toBeUndefined();
  });

  it("validates config with method", async () => {
    const config = {
      url: "https://example.com",
      method: "POST",
    };
    await expect(plugin.validate(config)).resolves.toBeUndefined();
  });

  it("throws error for missing URL", async () => {
    const config = {};
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for empty URL", async () => {
    const config = { url: "" };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for non-HTTP URL", async () => {
    const config = { url: "ftp://example.com" };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for invalid URL", async () => {
    const config = { url: "not-a-url" };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for invalid headers", async () => {
    const config = {
      url: "https://example.com",
      headers: "not-an-object",
    };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for non-string header value", async () => {
    const config = {
      url: "https://example.com",
      headers: { Authorization: 123 },
    };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for invalid timeout", async () => {
    const config = {
      url: "https://example.com",
      timeout: 500,
    };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("throws error for invalid method", async () => {
    const config = {
      url: "https://example.com",
      method: "INVALID",
    };
    await expect(plugin.validate(config)).rejects.toThrow(
      PluginConfigurationError,
    );
  });

  it("fetches successful response", async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("response content"),
        headers: new Headers({
          "content-type": "text/plain",
          etag: "12345",
        }),
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const config = { url: "https://example.com/test.txt" };

    const result = await plugin.fetch(config, context);

    expect(result.content).toBe("response content");
    expect(result.isDirectory).toBe(false);
    expect(result.metadata?.contentType).toBe("text/plain");
    expect(result.metadata?.etag).toBe("12345");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/test.txt",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "User-Agent": "knowhub/1.0.0",
        }),
      }),
    );
  });

  it("fetches with custom headers", async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("response content"),
        headers: new Headers(),
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const config = {
      url: "https://example.com/test.txt",
      headers: {
        Authorization: "Bearer token",
        "X-Custom": "value",
      },
    };

    await plugin.fetch(config, context);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/test.txt",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "knowhub/1.0.0",
          Authorization: "Bearer token",
          "X-Custom": "value",
        }),
      }),
    );
  });

  it("throws PluginError for HTTP error response", async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const config = { url: "https://example.com/missing.txt" };

    await expect(plugin.fetch(config, context)).rejects.toThrow(PluginError);
  });

  it("throws PluginError for network error", async () => {
    const mockFetch = mock(() => Promise.reject(new Error("Network error")));
    global.fetch = mockFetch as unknown as typeof fetch;

    const config = { url: "https://example.com/test.txt" };

    await expect(plugin.fetch(config, context)).rejects.toThrow(PluginError);
  });

  it("handles timeout", async () => {
    const mockFetch = mock((url: string, options: RequestInit) => {
      return new Promise((resolve, reject) => {
        if (options.signal) {
          options.signal.addEventListener("abort", () => {
            const abortError = new Error("This operation was aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }
      });
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const config = {
      url: "https://example.com/test.txt",
      timeout: 1000,
    };

    const error = await plugin.fetch(config, context).catch((e) => e);
    expect(error).toBeInstanceOf(PluginError);
    expect(error.message).toContain("Request timeout after 1000ms");
  });

  it("validates config before fetching", async () => {
    const config = { url: "" };

    await expect(plugin.fetch(config, context)).rejects.toThrow(
      PluginConfigurationError,
    );
  });
});

describe("PluginRegistry", () => {
  beforeEach(() => {
    pluginRegistry.clear();
    pluginRegistry.register(new LocalPlugin());
    pluginRegistry.register(new HttpPlugin());
  });

  it("lists available plugins", () => {
    const available = pluginRegistry.listAvailable();
    expect(available).toContain("local");
    expect(available).toContain("http");
  });

  it("checks if plugin exists", () => {
    expect(pluginRegistry.has("local")).toBe(true);
    expect(pluginRegistry.has("http")).toBe(true);
    expect(pluginRegistry.has("unknown")).toBe(false);
  });

  it("resolves existing plugin", () => {
    const localPlugin = pluginRegistry.resolve("local");
    expect(localPlugin.name).toBe("local");

    const httpPlugin = pluginRegistry.resolve("http");
    expect(httpPlugin.name).toBe("http");
  });

  it("throws error for unknown plugin", () => {
    expect(() => pluginRegistry.resolve("unknown")).toThrow("Plugin not found");
  });

  it("registers new plugin", () => {
    const testPlugin = {
      name: "test",
      version: "1.0.0",
      description: "Test plugin",
      fetch: async () => ({ content: "test" }),
    };

    pluginRegistry.register(testPlugin);

    expect(pluginRegistry.has("test")).toBe(true);
    expect(pluginRegistry.resolve("test")).toBe(testPlugin);
  });

  it("overwrites existing plugin when registering", () => {
    const testPlugin1 = {
      name: "test-overwrite",
      version: "1.0.0",
      description: "Test plugin 1",
      fetch: async () => ({ content: "test1" }),
    };

    const testPlugin2 = {
      name: "test-overwrite",
      version: "2.0.0",
      description: "Test plugin 2",
      fetch: async () => ({ content: "test2" }),
    };

    pluginRegistry.register(testPlugin1);
    expect(pluginRegistry.resolve("test-overwrite").version).toBe("1.0.0");

    pluginRegistry.register(testPlugin2);
    expect(pluginRegistry.resolve("test-overwrite").version).toBe("2.0.0");
  });
});
