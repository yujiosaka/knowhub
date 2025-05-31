import { describe, expect, it } from "bun:test";
import {
  PluginConfigurationError,
  PluginError,
  PluginNotFoundError,
} from "../../src/plugins/errors.js";

describe("Plugin Errors", () => {
  describe("PluginError", () => {
    it("creates error with plugin name and message", () => {
      const error = new PluginError("Something went wrong", "testPlugin");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error.name).toBe("PluginError");
      expect(error.message).toBe('Plugin "testPlugin": Something went wrong');
      expect(error.pluginName).toBe("testPlugin");
      expect(error.cause).toBeUndefined();
    });

    it("creates error with plugin name, message, and cause", () => {
      const originalError = new Error("Original error");
      const error = new PluginError(
        "Something went wrong",
        "testPlugin",
        originalError,
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error.name).toBe("PluginError");
      expect(error.message).toBe('Plugin "testPlugin": Something went wrong');
      expect(error.pluginName).toBe("testPlugin");
      expect(error.cause).toBe(originalError);
    });

    it("handles empty plugin name", () => {
      const error = new PluginError("Something went wrong", "");

      expect(error.message).toBe('Plugin "": Something went wrong');
      expect(error.pluginName).toBe("");
    });

    it("handles empty message", () => {
      const error = new PluginError("", "testPlugin");

      expect(error.message).toBe('Plugin "testPlugin": ');
      expect(error.pluginName).toBe("testPlugin");
    });

    it("handles special characters in plugin name", () => {
      const pluginName = "test-plugin_v1.0@example.com";
      const error = new PluginError("Something went wrong", pluginName);

      expect(error.message).toBe(
        `Plugin "${pluginName}": Something went wrong`,
      );
      expect(error.pluginName).toBe(pluginName);
    });

    it("handles multiline message", () => {
      const message = "Line 1\nLine 2\nLine 3";
      const error = new PluginError(message, "testPlugin");

      expect(error.message).toBe(`Plugin "testPlugin": ${message}`);
      expect(error.pluginName).toBe("testPlugin");
    });

    it("maintains error stack trace", () => {
      const error = new PluginError("Something went wrong", "testPlugin");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("PluginError");
      expect(error.stack).toContain("Something went wrong");
    });

    it("can be caught as generic Error", () => {
      try {
        throw new PluginError("Test error", "testPlugin");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PluginError);
        expect((error as PluginError).pluginName).toBe("testPlugin");
      }
    });
  });

  describe("PluginConfigurationError", () => {
    it("creates configuration error with all parameters", () => {
      const error = new PluginConfigurationError(
        "testPlugin",
        "url",
        "must be a valid URL",
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginConfigurationError);
      expect(error.name).toBe("PluginConfigurationError");
      expect(error.message).toBe(
        'Plugin "testPlugin": Invalid configuration for field "url": must be a valid URL',
      );
      expect(error.pluginName).toBe("testPlugin");
    });

    it("handles empty field name", () => {
      const error = new PluginConfigurationError(
        "testPlugin",
        "",
        "invalid value",
      );

      expect(error.message).toBe(
        'Plugin "testPlugin": Invalid configuration for field "": invalid value',
      );
      expect(error.pluginName).toBe("testPlugin");
    });

    it("handles empty field message", () => {
      const error = new PluginConfigurationError("testPlugin", "path", "");

      expect(error.message).toBe(
        'Plugin "testPlugin": Invalid configuration for field "path": ',
      );
      expect(error.pluginName).toBe("testPlugin");
    });

    it("handles complex field names", () => {
      const fieldName = "headers.authorization";
      const error = new PluginConfigurationError(
        "httpPlugin",
        fieldName,
        "must be provided",
      );

      expect(error.message).toBe(
        `Plugin "httpPlugin": Invalid configuration for field "${fieldName}": must be provided`,
      );
      expect(error.pluginName).toBe("httpPlugin");
    });

    it("handles special characters in field and message", () => {
      const fieldName = "config[0].value";
      const message = "must be between 1-100 characters";
      const error = new PluginConfigurationError(
        "testPlugin",
        fieldName,
        message,
      );

      expect(error.message).toBe(
        `Plugin "testPlugin": Invalid configuration for field "${fieldName}": ${message}`,
      );
      expect(error.pluginName).toBe("testPlugin");
    });

    it("can be caught as PluginError", () => {
      try {
        throw new PluginConfigurationError("testPlugin", "field", "invalid");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginError);
        expect(error).toBeInstanceOf(PluginConfigurationError);
        expect((error as PluginConfigurationError).pluginName).toBe(
          "testPlugin",
        );
      }
    });

    it("maintains inheritance chain", () => {
      const error = new PluginConfigurationError(
        "testPlugin",
        "field",
        "invalid",
      );

      expect(error instanceof Error).toBe(true);
      expect(error instanceof PluginError).toBe(true);
      expect(error instanceof PluginConfigurationError).toBe(true);
    });

    it("includes field information in error context", () => {
      const error = new PluginConfigurationError(
        "localPlugin",
        "path",
        "must be an absolute path",
      );

      expect(error.message).toContain("path");
      expect(error.message).toContain("absolute path");
      expect(error.message).toContain("localPlugin");
    });
  });

  describe("PluginNotFoundError", () => {
    it("creates not found error with plugin name", () => {
      const error = new PluginNotFoundError("missingPlugin");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginNotFoundError);
      expect(error.name).toBe("PluginNotFoundError");
      expect(error.message).toBe("Plugin not found: missingPlugin");
    });

    it("handles empty plugin name", () => {
      const error = new PluginNotFoundError("");

      expect(error.message).toBe("Plugin not found: ");
    });

    it("handles special characters in plugin name", () => {
      const pluginName = "my-plugin@1.0.0";
      const error = new PluginNotFoundError(pluginName);

      expect(error.message).toBe(`Plugin not found: ${pluginName}`);
    });

    it("handles very long plugin names", () => {
      const pluginName = "a".repeat(1000);
      const error = new PluginNotFoundError(pluginName);

      expect(error.message).toBe(`Plugin not found: ${pluginName}`);
    });

    it("is not a PluginError subclass", () => {
      const error = new PluginNotFoundError("testPlugin");

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(PluginError);
      expect(error).toBeInstanceOf(PluginNotFoundError);
    });

    it("can be caught as generic Error", () => {
      try {
        throw new PluginNotFoundError("testPlugin");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PluginNotFoundError);
        expect((error as PluginNotFoundError).message).toContain("testPlugin");
      }
    });

    it("maintains error stack trace", () => {
      const error = new PluginNotFoundError("testPlugin");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("PluginNotFoundError");
      expect(error.stack).toContain("testPlugin");
    });
  });

  describe("Error hierarchy and relationships", () => {
    it("distinguishes between different error types", () => {
      const pluginError = new PluginError("generic error", "testPlugin");
      const configError = new PluginConfigurationError(
        "testPlugin",
        "field",
        "invalid",
      );
      const notFoundError = new PluginNotFoundError("testPlugin");

      expect(pluginError).toBeInstanceOf(PluginError);
      expect(pluginError).not.toBeInstanceOf(PluginConfigurationError);
      expect(pluginError).not.toBeInstanceOf(PluginNotFoundError);

      expect(configError).toBeInstanceOf(PluginError);
      expect(configError).toBeInstanceOf(PluginConfigurationError);
      expect(configError).not.toBeInstanceOf(PluginNotFoundError);

      expect(notFoundError).not.toBeInstanceOf(PluginError);
      expect(notFoundError).not.toBeInstanceOf(PluginConfigurationError);
      expect(notFoundError).toBeInstanceOf(PluginNotFoundError);
    });

    it("allows proper error type checking", () => {
      const errors = [
        new PluginError("generic error", "testPlugin"),
        new PluginConfigurationError("testPlugin", "field", "invalid"),
        new PluginNotFoundError("testPlugin"),
      ];

      for (const error of errors) {
        if (error instanceof PluginConfigurationError) {
          expect(error.pluginName).toBe("testPlugin");
          expect(error).toBeInstanceOf(PluginError);
        } else if (error instanceof PluginNotFoundError) {
          expect(error.message).toContain("testPlugin");
          expect(error).not.toBeInstanceOf(PluginError);
        } else if (error instanceof PluginError) {
          expect(error.pluginName).toBe("testPlugin");
          expect(error).not.toBeInstanceOf(PluginConfigurationError);
        }
      }
    });

    it("all plugin errors extend Error", () => {
      const errors = [
        new PluginError("generic error", "testPlugin"),
        new PluginConfigurationError("testPlugin", "field", "invalid"),
        new PluginNotFoundError("testPlugin"),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.stack).toBeDefined();
      }
    });

    it("preserves error properties in inheritance", () => {
      const configError = new PluginConfigurationError(
        "testPlugin",
        "url",
        "invalid URL",
      );

      expect(configError.name).toBe("PluginConfigurationError");
      expect(configError.message).toContain("invalid URL");
      expect(configError.stack).toBeDefined();

      expect(configError.pluginName).toBe("testPlugin");
      expect(configError.cause).toBeUndefined();

      expect(configError.message).toContain("url");
      expect(configError.message).toContain("Invalid configuration");
    });
  });

  describe("Error serialization and debugging", () => {
    it("provides useful toString output", () => {
      const error = new PluginError("Something went wrong", "testPlugin");
      const stringOutput = error.toString();

      expect(stringOutput).toContain("PluginError");
      expect(stringOutput).toContain("testPlugin");
      expect(stringOutput).toContain("Something went wrong");
    });

    it("includes plugin context in JSON serialization", () => {
      const error = new PluginError("Something went wrong", "testPlugin");
      const serialized = JSON.stringify(
        error,
        Object.getOwnPropertyNames(error),
      );
      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe("PluginError");
      expect(parsed.message).toContain("testPlugin");
      expect(parsed.pluginName).toBe("testPlugin");
    });

    it("handles error chaining for debugging", () => {
      const originalError = new Error("Network timeout");
      originalError.stack = "Original stack trace";

      const pluginError = new PluginError(
        "Failed to fetch data",
        "httpPlugin",
        originalError,
      );

      expect(pluginError.cause).toBe(originalError);
      expect(pluginError.message).toContain("Failed to fetch data");
      expect(pluginError.message).toContain("httpPlugin");
      expect(pluginError.cause?.message).toBe("Network timeout");
    });

    it("provides detailed error information for debugging", () => {
      const configError = new PluginConfigurationError(
        "localPlugin",
        "path",
        "must be absolute",
      );

      expect(configError.name).toBe("PluginConfigurationError");
      expect(configError.pluginName).toBe("localPlugin");
      expect(configError.message).toContain("path");
      expect(configError.message).toContain("absolute");
      expect(configError.message).toContain("localPlugin");
      expect(configError.message).toContain("Invalid configuration");
    });
  });
});
