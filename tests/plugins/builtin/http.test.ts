import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { TestLogger } from "../../../src/logger.js";
import { HttpPlugin } from "../../../src/plugins/builtin/http.js";
import {
  PluginConfigurationError,
  PluginError,
} from "../../../src/plugins/errors.js";
import type { PluginContext } from "../../../src/plugins/types.js";

describe("HttpPlugin", () => {
  let plugin: HttpPlugin;
  let context: PluginContext;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    plugin = new HttpPlugin();
    context = {
      projectRoot: "/tmp",
      logger: new TestLogger(),
    };
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("metadata", () => {
    it("has correct plugin name", () => {
      expect(plugin.name).toBe("http");
    });

    it("has correct version", () => {
      expect(plugin.version).toBe("1.0.0");
    });

    it("has descriptive description", () => {
      expect(plugin.description).toContain("HTTP");
      expect(plugin.description).toContain("advanced");
      expect(plugin.description).toContain("files");
    });

    it("has valid schema", () => {
      expect(plugin.schema).toBeDefined();
      expect(plugin.schema.type).toBe("object");
      expect(plugin.schema.required).toContain("url");
      expect(plugin.schema.properties).toBeDefined();
      expect(plugin.schema.properties?.url).toBeDefined();
      expect(plugin.schema.properties?.headers).toBeDefined();
      expect(plugin.schema.properties?.timeout).toBeDefined();
      expect(plugin.schema.properties?.method).toBeDefined();
      expect(plugin.schema.properties?.body).toBeDefined();
      expect(plugin.schema.additionalProperties).toBe(false);
    });
  });

  describe("validation - basic", () => {
    it("validates valid HTTP URL", async () => {
      const config = { url: "http://example.com" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates valid HTTPS URL", async () => {
      const config = { url: "https://example.com" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates URL with path", async () => {
      const config = { url: "https://example.com/path/to/file.txt" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates URL with query parameters", async () => {
      const config = {
        url: "https://api.example.com/data?param=value&other=123",
      };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates URL with port", async () => {
      const config = { url: "https://example.com:8443/api" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates URL with authentication", async () => {
      const config = { url: "https://user:pass@example.com/api" };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });
  });

  describe("validation - headers", () => {
    it("validates config with single header", async () => {
      const config = {
        url: "https://example.com",
        headers: { Authorization: "Bearer token" },
      };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates config with multiple headers", async () => {
      const config = {
        url: "https://example.com",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
          "User-Agent": "MyApp/1.0.0",
          "X-Custom-Header": "custom-value",
        },
      };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates config with empty headers object", async () => {
      const config = {
        url: "https://example.com",
        headers: {},
      };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("throws error for invalid headers type", async () => {
      const invalidHeaders = ["not-an-object", 123, [], null, true];

      for (const headers of invalidHeaders) {
        const config = { url: "https://example.com", headers };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("headers");
        expect(error.message).toContain("object");
      }
    });

    it("throws error for non-string header values", async () => {
      const configs = [
        { url: "https://example.com", headers: { Authorization: 123 } },
        { url: "https://example.com", headers: { "Content-Type": true } },
        { url: "https://example.com", headers: { "X-Custom": [] } },
        { url: "https://example.com", headers: { "X-Custom": {} } },
        { url: "https://example.com", headers: { "X-Custom": null } },
      ];

      for (const config of configs) {
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("must be a string");
      }
    });
  });

  describe("validation - timeout", () => {
    it("validates valid timeout values", async () => {
      const validTimeouts = [1000, 5000, 10000, 30000, 60000, 300000];

      for (const timeout of validTimeouts) {
        const config = { url: "https://example.com", timeout };
        await expect(plugin.validate(config)).resolves.toBeUndefined();
      }
    });

    it("throws error for timeout too low", async () => {
      const invalidTimeouts = [0, 500, 999];

      for (const timeout of invalidTimeouts) {
        const config = { url: "https://example.com", timeout };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("timeout");
        expect(error.message).toContain("1000");
        expect(error.message).toContain("300000");
      }
    });

    it("throws error for timeout too high", async () => {
      const invalidTimeouts = [300001, 500000, 1000000];

      for (const timeout of invalidTimeouts) {
        const config = { url: "https://example.com", timeout };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("timeout");
        expect(error.message).toContain("1000");
        expect(error.message).toContain("300000");
      }
    });

    it("throws error for non-number timeout", async () => {
      const invalidTimeouts = ["5000", true, [], {}, null];

      for (const timeout of invalidTimeouts) {
        const config = { url: "https://example.com", timeout };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("timeout");
      }
    });
  });

  describe("validation - method", () => {
    it("validates valid HTTP methods", async () => {
      const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

      for (const method of validMethods) {
        const config = { url: "https://example.com", method };
        await expect(plugin.validate(config)).resolves.toBeUndefined();
      }
    });

    it("validates case-insensitive methods", async () => {
      const methods = ["get", "post", "put", "patch", "delete", "head"];

      for (const method of methods) {
        const config = { url: "https://example.com", method };
        await expect(plugin.validate(config)).resolves.toBeUndefined();
      }
    });

    it("throws error for invalid methods", async () => {
      const invalidMethods = ["INVALID", "CONNECT", "TRACE", "OPTIONS", ""];

      for (const method of invalidMethods) {
        const config = { url: "https://example.com", method };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("method");
        expect(error.message).toContain("GET, POST, PUT, PATCH, DELETE, HEAD");
      }
    });

    it("throws error for non-string method", async () => {
      const invalidMethods = [123, true, [], {}, null];

      for (const method of invalidMethods) {
        const config = { url: "https://example.com", method };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("method");
      }
    });
  });

  describe("validation - body", () => {
    it("validates string body", async () => {
      const config = {
        url: "https://example.com",
        method: "POST",
        body: '{"key": "value"}',
      };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("validates empty string body", async () => {
      const config = {
        url: "https://example.com",
        method: "POST",
        body: "",
      };
      await expect(plugin.validate(config)).resolves.toBeUndefined();
    });

    it("throws error for non-string body", async () => {
      const invalidBodies = [123, true, [], {}, null];

      for (const body of invalidBodies) {
        const config = { url: "https://example.com", body };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("body");
        expect(error.message).toContain("string");
      }
    });
  });

  describe("validation - errors", () => {
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
      const invalidConfigs = ["string", 123, true];

      for (const config of invalidConfigs) {
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("must be an object");
      }
    });

    it("throws error for array config", async () => {
      const error = await plugin.validate([]).catch((e) => e);
      expect(error).toBeInstanceOf(PluginConfigurationError);
      expect(error.message).toContain("must be a non-empty string");
    });

    it("throws error for missing URL", async () => {
      const config = {};
      const error = await plugin.validate(config).catch((e) => e);
      expect(error).toBeInstanceOf(PluginConfigurationError);
      expect(error.message).toContain("url");
      expect(error.message).toContain("non-empty string");
    });

    it("throws error for empty URL", async () => {
      const config = { url: "" };
      const error = await plugin.validate(config).catch((e) => e);
      expect(error).toBeInstanceOf(PluginConfigurationError);
      expect(error.message).toContain("url");
      expect(error.message).toContain("non-empty string");
    });

    it("throws error for non-HTTP URL", async () => {
      const validNonHttpUrls = ["ftp://example.com", "file:///path/to/file"];

      for (const url of validNonHttpUrls) {
        const config = { url };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("must be a valid URL");
      }
    });

    it("throws error for invalid URL format", async () => {
      const invalidUrlFormats = [
        "not-a-url",
        "://missing-protocol",
        "mailto:user@example.com",
        "tel:+1234567890",
      ];

      for (const url of invalidUrlFormats) {
        const config = { url };
        const error = await plugin.validate(config).catch((e) => e);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect(error.message).toContain("must be a valid URL");
      }
    });

    it("handles edge case URLs", async () => {
      const edgeCases = ["https://", "https:///missing-host"];

      for (const url of edgeCases) {
        const config = { url };
        try {
          await plugin.validate(config);
        } catch (error) {
          expect(error).toBeInstanceOf(PluginConfigurationError);
          expect((error as PluginConfigurationError).message).toMatch(
            /must be (a valid URL|an HTTP\(S\) URL)/,
          );
        }
      }
    });

    it("includes plugin name in error messages", async () => {
      const error = await plugin.validate({ url: "" }).catch((e) => e);
      expect(error.message).toContain("http");
    });
  });

  describe("fetch - successful responses", () => {
    it("fetches successful response with content", async () => {
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
      expect(result.localPath).toBeUndefined();
      expect(result.metadata?.contentType).toBe("text/plain");
      expect(result.metadata?.etag).toBe("12345");
      expect(result.metadata?.lastModified).toBeUndefined();
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

    it("includes last-modified header in metadata", async () => {
      const lastModified = "Wed, 21 Oct 2015 07:28:00 GMT";
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers({
            "last-modified": lastModified,
          }),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = { url: "https://example.com/test.txt" };
      const result = await plugin.fetch(config, context);

      expect(result.metadata?.lastModified).toBeInstanceOf(Date);
      expect(result.metadata?.lastModified?.toUTCString()).toBe(lastModified);
    });

    it("includes response headers in metadata", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers({
            "content-type": "application/json",
            "x-rate-limit": "100",
            "x-custom-header": "value",
          }),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = { url: "https://example.com/api" };
      const result = await plugin.fetch(config, context);

      expect(result.metadata?.responseHeaders).toBeDefined();
      expect(result.metadata?.responseHeaders).toMatchObject({
        "content-type": "application/json",
        "x-rate-limit": "100",
        "x-custom-header": "value",
      });
    });
  });

  describe("fetch - HTTP methods", () => {
    it("uses GET method by default", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers(),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = { url: "https://example.com/test" };
      await plugin.fetch(config, context);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/test",
        expect.objectContaining({
          method: "GET",
        }),
      );
    });

    it("uses specified HTTP method", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers(),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const methods = ["POST", "PUT", "PATCH", "DELETE"];
      for (const method of methods) {
        const config = { url: "https://example.com/test", method };
        await plugin.fetch(config, context);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://example.com/test",
          expect.objectContaining({
            method: method.toUpperCase(),
          }),
        );
      }
    });

    it("includes body for POST/PUT/PATCH requests", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers(),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const bodyMethods = ["POST", "PUT", "PATCH"];
      for (const method of bodyMethods) {
        const config = {
          url: "https://example.com/test",
          method,
          body: '{"data": "value"}',
        };
        await plugin.fetch(config, context);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://example.com/test",
          expect.objectContaining({
            method: method.toUpperCase(),
            body: '{"data": "value"}',
          }),
        );
      }
    });

    it("excludes body for GET/DELETE/HEAD requests", async () => {
      let fetchCallOptions: RequestInit | undefined;
      const mockFetch = mock((url: string, options?: RequestInit) => {
        fetchCallOptions = options;
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers(),
        });
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const noBodyMethods = ["GET", "DELETE", "HEAD"];
      for (const method of noBodyMethods) {
        fetchCallOptions = undefined;
        const config = {
          url: "https://example.com/test",
          method,
          body: '{"data": "value"}',
        };
        await plugin.fetch(config, context);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://example.com/test",
          expect.objectContaining({
            method: method.toUpperCase(),
          }),
        );

        expect(fetchCallOptions).toBeDefined();
        expect(fetchCallOptions).not.toHaveProperty("body");
      }
    });
  });

  describe("fetch - error handling", () => {
    it("throws PluginError for HTTP error responses", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = { url: "https://example.com/missing.txt" };
      const error = await plugin.fetch(config, context).catch((e) => e);

      expect(error).toBeInstanceOf(PluginError);
      expect(error.message).toContain("HTTP 404 Not Found");
      expect(error.message).toContain("https://example.com/missing.txt");
      expect(error.pluginName).toBe("http");
    });

    it("throws PluginError for network errors", async () => {
      const mockFetch = mock(() => Promise.reject(new Error("Network error")));
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = { url: "https://example.com/test.txt" };
      const error = await plugin.fetch(config, context).catch((e) => e);

      expect(error).toBeInstanceOf(PluginError);
      expect(error.message).toContain("Network error");
      expect(error.pluginName).toBe("http");
    });

    it("handles timeout correctly", async () => {
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
      const error = await plugin.fetch(config, context).catch((e) => e);

      expect(error).toBeInstanceOf(PluginConfigurationError);
    });
  });

  describe("metadata handling", () => {
    it("handles missing response headers gracefully", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers(),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = { url: "https://example.com/test.txt" };
      const result = await plugin.fetch(config, context);

      expect(result.metadata?.lastModified).toBeUndefined();
      expect(result.metadata?.etag).toBeUndefined();
      expect(result.metadata?.contentType).toBeUndefined();
      expect(result.metadata?.responseHeaders).toBeDefined();
    });

    it("includes all response headers in metadata", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("content"),
          headers: new Headers({
            "content-type": "text/plain",
            "cache-control": "no-cache",
            "x-custom": "value",
          }),
        }),
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = { url: "https://example.com/test.txt" };
      const result = await plugin.fetch(config, context);

      expect(result.metadata?.responseHeaders).toMatchObject({
        "content-type": "text/plain",
        "cache-control": "no-cache",
        "x-custom": "value",
      });
    });
  });
});
