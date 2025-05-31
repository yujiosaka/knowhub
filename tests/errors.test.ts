import { describe, expect, it } from "bun:test";
import {
  ConfigurationError,
  FileOperationError,
  KnowhubError,
  ResourceError,
  ValidationError,
  formatError,
  handleNodeError,
} from "../src/errors.js";

describe("KnowhubError", () => {
  it("create a basic error with message", () => {
    const error = new KnowhubError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("KnowhubError");
    expect(error.code).toBeUndefined();
  });

  it("create an error with code", () => {
    const error = new KnowhubError("Test error", "TEST_CODE");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("KnowhubError");
    expect(error.code).toBe("TEST_CODE");
  });

  it("is an instance of Error", () => {
    const error = new KnowhubError("Test error");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof KnowhubError).toBe(true);
  });
});

describe("ConfigurationError", () => {
  it("create configuration error with message", () => {
    const error = new ConfigurationError("Config error");
    expect(error.message).toBe("Config error");
    expect(error.name).toBe("ConfigurationError");
    expect(error.code).toBe("CONFIG_ERROR");
    expect(error.configPath).toBeUndefined();
  });

  it("create configuration error with config path", () => {
    const error = new ConfigurationError("Config error", "/path/to/config");
    expect(error.message).toBe("Config error");
    expect(error.configPath).toBe("/path/to/config");
    expect(error instanceof KnowhubError).toBe(true);
  });
});

describe("ResourceError", () => {
  it("create resource error with message", () => {
    const error = new ResourceError("Resource error");
    expect(error.message).toBe("Resource error");
    expect(error.name).toBe("ResourceError");
    expect(error.code).toBe("RESOURCE_ERROR");
    expect(error.resourcePath).toBeUndefined();
  });

  it("create resource error with resource path", () => {
    const error = new ResourceError("Resource error", "/path/to/resource");
    expect(error.message).toBe("Resource error");
    expect(error.resourcePath).toBe("/path/to/resource");
    expect(error instanceof KnowhubError).toBe(true);
  });
});

describe("ValidationError", () => {
  it("create validation error with message", () => {
    const error = new ValidationError("Validation error");
    expect(error.message).toBe("Validation error");
    expect(error.name).toBe("ValidationError");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.field).toBeUndefined();
  });

  it("create validation error with field", () => {
    const error = new ValidationError("Validation error", "field.name");
    expect(error.message).toBe("Validation error");
    expect(error.field).toBe("field.name");
    expect(error instanceof KnowhubError).toBe(true);
  });
});

describe("FileOperationError", () => {
  it("create file operation error with message", () => {
    const error = new FileOperationError("File error");
    expect(error.message).toBe("File error");
    expect(error.name).toBe("FileOperationError");
    expect(error.code).toBe("FILE_ERROR");
    expect(error.filePath).toBeUndefined();
    expect(error.operation).toBeUndefined();
  });

  it("create file operation error with file path and operation", () => {
    const error = new FileOperationError("File error", "/path/to/file", "copy");
    expect(error.message).toBe("File error");
    expect(error.filePath).toBe("/path/to/file");
    expect(error.operation).toBe("copy");
    expect(error instanceof KnowhubError).toBe(true);
  });
});

describe("formatError", () => {
  it("format Error instances", () => {
    const error = new Error("Test error message");
    expect(formatError(error)).toBe("Test error message");
  });

  it("format string errors", () => {
    expect(formatError("String error")).toBe("String error");
  });

  it("format number errors", () => {
    expect(formatError(42)).toBe("42");
  });

  it("format object errors", () => {
    expect(formatError({ error: "test" })).toBe("[object Object]");
  });

  it("format undefined errors", () => {
    expect(formatError(undefined)).toBe("undefined");
  });

  it("format null errors", () => {
    expect(formatError(null)).toBe("null");
  });
});

describe("handleNodeError", () => {
  it("handle ENOENT errors", () => {
    const nodeError = { code: "ENOENT", message: "File not found" };
    try {
      handleNodeError(nodeError, "/test/path", "read");
      expect(false).toBe(true);
    } catch (error) {
      const fileError = error as FileOperationError;
      expect(fileError instanceof FileOperationError).toBe(true);
      expect(fileError.message).toBe("Path does not exist: /test/path");
      expect(fileError.filePath).toBe("/test/path");
      expect(fileError.operation).toBe("read");
    }
  });

  it("handle EACCES errors", () => {
    const nodeError = { code: "EACCES", message: "Permission denied" };
    try {
      handleNodeError(nodeError, "/test/path", "write");
      expect(false).toBe(true);
    } catch (error) {
      const fileError = error as FileOperationError;
      expect(fileError instanceof FileOperationError).toBe(true);
      expect(fileError.message).toBe(
        "No permission to access path: /test/path",
      );
      expect(fileError.filePath).toBe("/test/path");
      expect(fileError.operation).toBe("write");
    }
  });

  it("handle EPERM errors", () => {
    const nodeError = { code: "EPERM", message: "Operation not permitted" };
    try {
      handleNodeError(nodeError, "/test/path", "symlink");
      expect(false).toBe(true);
    } catch (error) {
      const fileError = error as FileOperationError;
      expect(fileError instanceof FileOperationError).toBe(true);
      expect(fileError.message).toBe("Operation not permitted: /test/path");
      expect(fileError.filePath).toBe("/test/path");
      expect(fileError.operation).toBe("symlink");
    }
  });

  it("handle unknown error codes", () => {
    const nodeError = Object.assign(new Error("Unknown error"), {
      code: "UNKNOWN",
    });
    try {
      handleNodeError(nodeError, "/test/path", "copy");
      expect(false).toBe(true);
    } catch (error) {
      const fileError = error as FileOperationError;
      expect(fileError instanceof FileOperationError).toBe(true);
      expect(fileError.message).toBe(
        'copy failed for "/test/path": Unknown error',
      );
      expect(fileError.filePath).toBe("/test/path");
      expect(fileError.operation).toBe("copy");
    }
  });

  it("handle non-Error objects", () => {
    const nonError = "String error";
    try {
      handleNodeError(nonError, "/test/path", "copy");
      expect(false).toBe(true);
    } catch (error) {
      const fileError = error as FileOperationError;
      expect(fileError instanceof FileOperationError).toBe(true);
      expect(fileError.message).toBe(
        'copy failed for "/test/path": String error',
      );
    }
  });

  it("handle Error objects without code", () => {
    const nodeError = new Error("Generic error");
    try {
      handleNodeError(nodeError, "/test/path", "copy");
      expect(false).toBe(true);
    } catch (error) {
      const fileError = error as FileOperationError;
      expect(fileError instanceof FileOperationError).toBe(true);
      expect(fileError.message).toBe(
        'copy failed for "/test/path": Generic error',
      );
    }
  });
});
