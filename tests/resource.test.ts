import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { ValidatedResource } from "../src/config.js";
import { ResourceError } from "../src/errors.js";
import { fetchResources } from "../src/resource.js";
import {
  TestEnvironment,
  mockFetch,
  mockHttpServer,
} from "./helpers/test-utils.js";

describe("fetchResources", () => {
  let testEnv: TestEnvironment;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    testEnv = new TestEnvironment("fetch-resources");
    await testEnv.setup();
    mockHttpServer.clear();

    originalFetch = global.fetch;
    (global as typeof globalThis & { fetch: typeof fetch }).fetch =
      mockFetch as typeof fetch;
  });

  afterEach(async () => {
    await testEnv.cleanup();

    global.fetch = originalFetch;
  });

  it("fetch local file resource", async () => {
    const content = "test file content";
    await testEnv.createFile("test.txt", content);

    const resources: ValidatedResource[] = [
      {
        plugin: "local",
        pluginConfig: { path: testEnv.path("test.txt"), symlink: false },
        overwrite: true,
        outputs: ["output.txt"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(1);
    expect(fetchedResources[0]?.definition).toBeDefined();
    expect(fetchedResources[0]?.localPath).toBe(testEnv.path("test.txt"));
    expect(fetchedResources[0]?.isDirectory).toBe(false);
    expect(fetchedResources[0]?.content).toBeUndefined();
  });

  it("fetch local directory resource", async () => {
    await testEnv.createDirectory("test-dir");

    const resources: ValidatedResource[] = [
      {
        plugin: "local",
        pluginConfig: { path: testEnv.path("test-dir"), symlink: true },
        overwrite: false,
        outputs: ["output-dir"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(1);
    expect(fetchedResources[0]?.definition).toBeDefined();
    expect(fetchedResources[0]?.localPath).toBe(testEnv.path("test-dir"));
    expect(fetchedResources[0]?.isDirectory).toBe(true);
    expect(fetchedResources[0]?.content).toBeUndefined();
  });

  it("fetch URL resource", async () => {
    const url = "https://example.com/file.txt";
    const content = "remote file content";
    mockHttpServer.setResponse(url, 200, content);

    const resources: ValidatedResource[] = [
      {
        plugin: "http",
        pluginConfig: { url },

        overwrite: true,
        outputs: ["output.txt"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(1);
    expect(fetchedResources[0]?.definition).toBeDefined();
    expect(fetchedResources[0]?.localPath).toBeUndefined();
    expect(fetchedResources[0]?.isDirectory).toBe(false);
    expect(fetchedResources[0]?.content).toBe(content);
  });

  it("fetch multiple resources", async () => {
    const fileContent = "local file content";
    await testEnv.createFile("local.txt", fileContent);
    await testEnv.createDirectory("local-dir");

    const url = "https://api.example.com/data.json";
    const urlContent = '{"data": true}';
    mockHttpServer.setResponse(url, 200, urlContent);

    const resources: ValidatedResource[] = [
      {
        plugin: "local",
        pluginConfig: { path: testEnv.path("local.txt") },

        overwrite: true,
        outputs: ["local-output.txt"],
      },
      {
        plugin: "local",
        pluginConfig: { path: testEnv.path("local-dir") },

        overwrite: true,
        outputs: ["local-dir-output"],
      },
      {
        plugin: "http",
        pluginConfig: { url },

        overwrite: true,
        outputs: ["remote-output.json"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(3);
    expect(fetchedResources[0]?.localPath).toBe(testEnv.path("local.txt"));
    expect(fetchedResources[0]?.isDirectory).toBe(false);
    expect(fetchedResources[1]?.localPath).toBe(testEnv.path("local-dir"));
    expect(fetchedResources[1]?.isDirectory).toBe(true);
    expect(fetchedResources[2]?.content).toBe(urlContent);
  });

  it("handle relative paths correctly", async () => {
    await testEnv.createFile("relative.txt", "relative content");

    const resources: ValidatedResource[] = [
      {
        plugin: "local",
        pluginConfig: { path: "./relative.txt" },

        overwrite: true,
        outputs: ["relative-output.txt"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(1);
    expect(fetchedResources[0]?.localPath).toBeDefined();
  });

  it("throw error for non-existent local file", async () => {
    const resources: ValidatedResource[] = [
      {
        plugin: "local",
        pluginConfig: { path: testEnv.path("does-not-exist.txt") },

        overwrite: true,
        outputs: ["output.txt"],
      },
    ];

    await expect(fetchResources(resources, testEnv.tempDir)).rejects.toThrow(
      ResourceError,
    );
  });

  it("throw ResourceError for HTTP error responses", async () => {
    const url = "https://example.com/not-found.txt";
    mockHttpServer.setResponse(url, 404, "Not Found");

    const resources: ValidatedResource[] = [
      {
        plugin: "http",
        pluginConfig: { url },

        overwrite: true,
        outputs: ["output.txt"],
      },
    ];

    await expect(fetchResources(resources, testEnv.tempDir)).rejects.toThrow(
      ResourceError,
    );
  });

  it("throw ResourceError for network errors", async () => {
    const url = "https://non-existent-domain.invalid/file.txt";
    const resources: ValidatedResource[] = [
      {
        plugin: "http",
        pluginConfig: { url },

        overwrite: true,
        outputs: ["output.txt"],
      },
    ];

    await expect(fetchResources(resources, testEnv.tempDir)).rejects.toThrow(
      ResourceError,
    );
  });

  it("handle URLs with various content types", async () => {
    const jsonUrl = "https://api.example.com/data.json";
    const textUrl = "https://example.com/readme.txt";
    const yamlUrl = "https://raw.githubusercontent.com/user/repo/config.yaml";

    mockHttpServer.setResponse(jsonUrl, 200, '{"key": "value"}');
    mockHttpServer.setResponse(textUrl, 200, "This is a text file content.");
    mockHttpServer.setResponse(yamlUrl, 200, "key: value\narray:\n  - item1");

    const resources: ValidatedResource[] = [
      {
        plugin: "http",
        pluginConfig: { url: jsonUrl },

        overwrite: true,
        outputs: ["data.json"],
      },
      {
        plugin: "http",
        pluginConfig: { url: textUrl },

        overwrite: true,
        outputs: ["readme.txt"],
      },
      {
        plugin: "http",
        pluginConfig: { url: yamlUrl },

        overwrite: true,
        outputs: ["config.yaml"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(3);
    expect(fetchedResources[0]?.content).toBe('{"key": "value"}');
    expect(fetchedResources[1]?.content).toBe("This is a text file content.");
    expect(fetchedResources[2]?.content).toBe("key: value\narray:\n  - item1");
  });

  it("handle empty resources array", async () => {
    const resources: ValidatedResource[] = [];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(0);
  });

  it("use project root for path resolution", async () => {
    await testEnv.createFile("project-file.txt", "project content");

    const resources: ValidatedResource[] = [
      {
        plugin: "local",
        pluginConfig: { path: "project-file.txt" },

        overwrite: true,
        outputs: ["project-output.txt"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(1);
    expect(fetchedResources[0]?.localPath).toBeDefined();
  });

  it("preserve resource definition in fetched resource", async () => {
    await testEnv.createFile("test.txt", "content");

    const originalResource: ValidatedResource = {
      plugin: "local",
      pluginConfig: { path: testEnv.path("test.txt") },

      overwrite: false,
      outputs: ["output1.txt", "output2.txt"],
    };

    const resources = [originalResource];
    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources[0]?.definition).toBe(originalResource);

    expect(fetchedResources[0]?.definition.overwrite).toBe(false);
    expect(fetchedResources[0]?.definition.outputs).toEqual([
      "output1.txt",
      "output2.txt",
    ]);
  });

  it("handle mixed success and failure scenarios", async () => {
    await testEnv.createFile("valid.txt", "valid content");

    const validUrl = "https://example.com/valid.txt";
    const invalidUrl = "https://example.com/invalid.txt";

    mockHttpServer.setResponse(validUrl, 200, "valid url content");
    mockHttpServer.setResponse(invalidUrl, 500, "Server Error");

    const resources: ValidatedResource[] = [
      {
        plugin: "local",
        pluginConfig: { path: testEnv.path("valid.txt") },

        overwrite: true,
        outputs: ["valid-local.txt"],
      },
      {
        plugin: "http",
        pluginConfig: { url: validUrl },

        overwrite: true,
        outputs: ["valid-remote.txt"],
      },
      {
        plugin: "http",
        pluginConfig: { url: invalidUrl },

        overwrite: true,
        outputs: ["invalid-remote.txt"],
      },
    ];

    await expect(fetchResources(resources, testEnv.tempDir)).rejects.toThrow(
      ResourceError,
    );
  });

  it("handle Unicode content in URLs", async () => {
    const url = "https://example.com/unicode.txt";
    const unicodeContent = "Unicode: 你好 🌟 こんにちは";
    mockHttpServer.setResponse(url, 200, unicodeContent);

    const resources: ValidatedResource[] = [
      {
        plugin: "http",
        pluginConfig: { url },

        overwrite: true,
        outputs: ["unicode.txt"],
      },
    ];

    const fetchedResources = await fetchResources(resources, testEnv.tempDir);

    expect(fetchedResources).toHaveLength(1);
    expect(fetchedResources[0]?.content).toBe(unicodeContent);
  });
});
