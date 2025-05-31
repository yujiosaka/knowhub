import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Resource } from "../src/config.js";
import { ValidationError } from "../src/errors.js";
import {
  validateConfigStructure,
  validateLocalPath,
  validateOutputs,
  validateOverwrite,
  validateResource,
  validateResourceSource,
  validateResourceStructure,
  validateUrlFormat,
} from "../src/validators.js";
import { TestEnvironment } from "./helpers/test-utils.js";

describe("validateResourceSource", () => {
  it("validates resource with local plugin", () => {
    const resource = {
      plugin: "local",
      pluginConfig: { path: "./test/path" },
      outputs: ["output"],
    };
    expect(() => validateResourceSource(resource, "resource")).not.toThrow();
  });

  it("validates resource with http plugin", () => {
    const resource = {
      plugin: "http",
      pluginConfig: { url: "https://example.com" },
      outputs: ["output"],
    };
    expect(() => validateResourceSource(resource, "resource")).not.toThrow();
  });

  it("throw error when plugin is missing", () => {
    const resource = {
      pluginConfig: { path: "./test" },
      outputs: ["output"],
    };
    expect(() =>
      validateResourceSource(resource as unknown as Resource, "resource"),
    ).toThrow(ValidationError);
  });

  it("throw error when plugin is empty string", () => {
    const resource = {
      plugin: "",
      pluginConfig: { path: "./test" },
      outputs: ["output"],
    };
    expect(() => validateResourceSource(resource, "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error when pluginConfig is missing", () => {
    const resource = {
      plugin: "local",
      outputs: ["output"],
    };
    expect(() =>
      validateResourceSource(resource as unknown as Resource, "resource"),
    ).toThrow(ValidationError);
  });

  it("throw error for unknown plugin", () => {
    const resource = {
      plugin: "unknown",
      pluginConfig: { something: "value" },
      outputs: ["output"],
    };
    expect(() => validateResourceSource(resource, "resource")).toThrow(
      ValidationError,
    );
  });
});

describe("validateOverwrite", () => {
  it("returns default true when undefined", () => {
    expect(validateOverwrite(undefined, "resource")).toBe(true);
  });

  it("validates true value", () => {
    expect(validateOverwrite(true, "resource")).toBe(true);
  });

  it("validates false value", () => {
    expect(validateOverwrite(false, "resource")).toBe(false);
  });

  it("throw error for string value", () => {
    expect(() => validateOverwrite("true", "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error for number value", () => {
    expect(() => validateOverwrite(1, "resource")).toThrow(ValidationError);
  });

  it("throw error for null value", () => {
    expect(() => validateOverwrite(null, "resource")).toThrow(ValidationError);
  });
});

describe("validateOutputs", () => {
  it("validates single string output", () => {
    const result = validateOutputs("output", "resource");
    expect(result).toEqual(["output"]);
  });

  it("validates array of string outputs", () => {
    const result = validateOutputs(["output1", "output2"], "resource");
    expect(result).toEqual(["output1", "output2"]);
  });

  it("throw error for empty string output", () => {
    expect(() => validateOutputs("", "resource")).toThrow(ValidationError);
  });

  it("throw error for empty array", () => {
    expect(() => validateOutputs([], "resource")).toThrow(ValidationError);
  });

  it("throw error for array with empty string", () => {
    expect(() => validateOutputs(["valid", ""], "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error for array with non-string", () => {
    expect(() => validateOutputs(["valid", 123], "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error for null outputs", () => {
    expect(() => validateOutputs(null, "resource")).toThrow(ValidationError);
  });

  it("throw error for undefined outputs", () => {
    expect(() => validateOutputs(undefined, "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error for number outputs", () => {
    expect(() => validateOutputs(123, "resource")).toThrow(ValidationError);
  });

  it("throw error for object outputs", () => {
    expect(() => validateOutputs({}, "resource")).toThrow(ValidationError);
  });
});

describe("validateUrlFormat", () => {
  it("validates http URL", () => {
    expect(() => validateUrlFormat("http://example.com")).not.toThrow();
  });

  it("validates https URL", () => {
    expect(() => validateUrlFormat("https://example.com")).not.toThrow();
  });

  it("validates complex https URL", () => {
    expect(() =>
      validateUrlFormat("https://api.example.com/v1/data?format=json"),
    ).not.toThrow();
  });

  it("throw error for ftp URL", () => {
    expect(() => validateUrlFormat("ftp://example.com")).toThrow(
      ValidationError,
    );
  });

  it("throw error for relative path", () => {
    expect(() => validateUrlFormat("./relative/path")).toThrow(ValidationError);
  });

  it("throw error for absolute path", () => {
    expect(() => validateUrlFormat("/absolute/path")).toThrow(ValidationError);
  });

  it("throw error for invalid URL format", () => {
    expect(() => validateUrlFormat("not-a-url")).toThrow(ValidationError);
  });

  it("throw error for malformed URL", () => {
    expect(() => validateUrlFormat("https://")).toThrow(ValidationError);
  });
});

describe("validateConfigStructure", () => {
  it("validates valid config", () => {
    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: { path: "./test" },
          outputs: ["output"],
        },
      ],
    };
    expect(() => validateConfigStructure(config)).not.toThrow();
  });

  it("throw error for null config", () => {
    expect(() => validateConfigStructure(null)).toThrow(ValidationError);
  });

  it("throw error for undefined config", () => {
    expect(() => validateConfigStructure(undefined)).toThrow(ValidationError);
  });

  it("throw error for non-object config", () => {
    expect(() => validateConfigStructure("string")).toThrow(ValidationError);
  });

  it("throw error for config without resources", () => {
    expect(() => validateConfigStructure({})).toThrow(ValidationError);
  });

  it("throw error for config with non-array resources", () => {
    expect(() => validateConfigStructure({ resources: "not-array" })).toThrow(
      ValidationError,
    );
  });

  it("throw error for config with empty resources array", () => {
    expect(() => validateConfigStructure({ resources: [] })).toThrow(
      ValidationError,
    );
  });

  it("include config path in error", () => {
    try {
      validateConfigStructure(null, "/path/to/config");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe("/path/to/config");
    }
  });
});

describe("validateResourceStructure", () => {
  it("validates valid resource object", () => {
    const resource = {
      plugin: "local",
      pluginConfig: { path: "./test" },
      outputs: ["output"],
    };
    expect(() => validateResourceStructure(resource, "resource")).not.toThrow();
  });

  it("throw error for null resource", () => {
    expect(() => validateResourceStructure(null, "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error for undefined resource", () => {
    expect(() => validateResourceStructure(undefined, "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error for non-object resource", () => {
    expect(() => validateResourceStructure("string", "resource")).toThrow(
      ValidationError,
    );
  });

  it("throw error for array resource", () => {
    expect(() => validateResourceStructure([], "resource")).toThrow(
      ValidationError,
    );
  });
});

describe("validateLocalPath", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("validators");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("validates existing file", async () => {
    await testEnv.createFile("test.txt", "content");
    const filePath = testEnv.path("test.txt");
    await expect(async () => await validateLocalPath(filePath)).not.toThrow();
  });

  it("validates existing directory", async () => {
    await testEnv.createDirectory("test-dir");
    const dirPath = testEnv.path("test-dir");
    await expect(async () => await validateLocalPath(dirPath)).not.toThrow();
  });

  it("throw error for non-existent path", async () => {
    const nonExistentPath = testEnv.path("non-existent");
    await expect(validateLocalPath(nonExistentPath)).rejects.toThrow();
  });

  it("validates relative path", async () => {
    await testEnv.createFile("relative.txt", "content");
    process.chdir(testEnv.tempDir);
    await expect(
      async () => await validateLocalPath("relative.txt"),
    ).not.toThrow();
  });
});

describe("validateResource", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("validate-resource");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("validates complete resource with local plugin", async () => {
    await testEnv.createFile("test.txt", "content");
    const resource = {
      plugin: "local",
      pluginConfig: { path: testEnv.path("test.txt") },
      symlink: false,
      overwrite: true,
      outputs: ["output1", "output2"],
    };

    const result = await validateResource(resource);

    expect(result.plugin).toBe("local");
    expect(result.pluginConfig).toEqual({ path: testEnv.path("test.txt") });
    expect(result.overwrite).toBe(true);
    expect(result.outputs).toEqual(["output1", "output2"]);
  });

  it("validates resource with http plugin", async () => {
    const resource = {
      plugin: "http",
      pluginConfig: { url: "https://example.com/file.txt" },
      overwrite: false,
      outputs: "single-output",
    };

    const result = await validateResource(resource);

    expect(result.plugin).toBe("http");
    expect(result.pluginConfig).toEqual({
      url: "https://example.com/file.txt",
    });
    expect(result.overwrite).toBe(false);
    expect(result.outputs).toEqual(["single-output"]);
  });

  it("apply defaults for optional fields", async () => {
    const resource = {
      plugin: "http",
      pluginConfig: { url: "https://example.com/file.txt" },
      outputs: ["output"],
    };

    const result = await validateResource(resource);

    expect(result.overwrite).toBe(true);
    expect(result.outputs).toEqual(["output"]);
  });

  it("throw error for invalid resource structure", async () => {
    await expect(validateResource(null as unknown as Resource)).rejects.toThrow(
      ValidationError,
    );
  });

  it("throw error for missing plugin", async () => {
    const resource = {
      pluginConfig: { path: "./test" },
      outputs: ["output"],
    };
    await expect(
      validateResource(resource as unknown as Resource),
    ).rejects.toThrow(ValidationError);
  });

  it("throw error for missing pluginConfig", async () => {
    const resource = {
      plugin: "local",
      outputs: ["output"],
    };
    await expect(
      validateResource(resource as unknown as Resource),
    ).rejects.toThrow(ValidationError);
  });

  it("throw error for unknown plugin", async () => {
    const resource = {
      plugin: "unknown",
      pluginConfig: { something: "value" },
      outputs: ["output"],
    };
    await expect(validateResource(resource)).rejects.toThrow(ValidationError);
  });

  it("throw error for invalid overwrite value", async () => {
    const resource = {
      plugin: "local",
      pluginConfig: { path: "./test" },
      overwrite: "true" as unknown as boolean,
      outputs: ["output"],
    };
    await expect(validateResource(resource)).rejects.toThrow(ValidationError);
  });

  it("throw error for invalid outputs", async () => {
    const resource = {
      plugin: "local",
      pluginConfig: { path: "./test" },
      outputs: null as unknown as string[],
    };
    await expect(validateResource(resource)).rejects.toThrow(ValidationError);
  });

  it("include resource path in error messages", async () => {
    const resource = {
      plugin: "unknown",
      pluginConfig: { something: "value" },
      outputs: ["output"],
    };
    try {
      await validateResource(resource, "resources[0]");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe("resources[0].plugin");
    }
  });
});
