import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ValidatedResource } from "./config.js";
import type { Resource } from "./config.js";
import { ValidationError, handleNodeError } from "./errors.js";
import { pluginRegistry } from "./plugins/index.js";

const UrlProtocol = {
  Http: "http://",
  Https: "https://",
} as const;
type UrlProtocol = (typeof UrlProtocol)[keyof typeof UrlProtocol];

export function validateResourceSource(
  resource: Resource,
  resourcePath: string,
): void {
  if (typeof resource.plugin !== "string" || resource.plugin.length === 0) {
    throw new ValidationError(
      'Resource must have a "plugin" field with a non-empty string',
      `${resourcePath}.plugin`,
    );
  }

  if (!pluginRegistry.has(resource.plugin)) {
    const availablePlugins = pluginRegistry.listAvailable();
    throw new ValidationError(
      `Unknown plugin "${resource.plugin}". Available plugins: ${availablePlugins.join(", ")}`,
      `${resourcePath}.plugin`,
    );
  }

  if (resource.pluginConfig === undefined) {
    throw new ValidationError(
      'Resource must have a "pluginConfig" field',
      `${resourcePath}.pluginConfig`,
    );
  }
}

export function validateOverwrite(
  overwrite: unknown,
  resourcePath: string,
): boolean {
  if (overwrite === undefined) {
    return true;
  }

  if (typeof overwrite !== "boolean") {
    throw new ValidationError(
      "overwrite must be a boolean",
      `${resourcePath}.overwrite`,
    );
  }

  return overwrite;
}

export function validateOutputs(
  outputs: unknown,
  resourcePath: string,
): string[] {
  if (!outputs) {
    throw new ValidationError(
      'Resource must have "outputs"',
      `${resourcePath}.outputs`,
    );
  }

  if (typeof outputs === "string") {
    if (outputs.length === 0) {
      throw new ValidationError(
        "Output path cannot be empty",
        `${resourcePath}.outputs`,
      );
    }
    return [outputs];
  }

  if (Array.isArray(outputs)) {
    if (outputs.length === 0) {
      throw new ValidationError(
        "outputs array cannot be empty",
        `${resourcePath}.outputs`,
      );
    }

    const validatedOutputs: string[] = [];
    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i];
      if (typeof output !== "string" || output.length === 0) {
        throw new ValidationError(
          "Each output must be a non-empty string",
          `${resourcePath}.outputs[${i}]`,
        );
      }
      validatedOutputs.push(output);
    }
    return validatedOutputs;
  }

  throw new ValidationError(
    "outputs must be a string or array of strings",
    `${resourcePath}.outputs`,
  );
}

export function validateUrlFormat(url: string): void {
  if (!url.startsWith(UrlProtocol.Http) && !url.startsWith(UrlProtocol.Https)) {
    throw new ValidationError(
      `URL must start with ${UrlProtocol.Http} or ${UrlProtocol.Https}, got: ${url}`,
    );
  }

  try {
    new URL(url);
  } catch (error) {
    throw new ValidationError(`Invalid URL format: ${url}`);
  }
}

export function validateConfigStructure(
  config: unknown,
  configPath?: string,
): void {
  if (!config || typeof config !== "object") {
    throw new ValidationError("Configuration must be an object", configPath);
  }

  const configObj = config as Record<string, unknown>;

  if (!Array.isArray(configObj.resources)) {
    throw new ValidationError(
      'Configuration must have a "resources" array',
      configPath,
    );
  }

  if (configObj.resources.length === 0) {
    throw new ValidationError(
      "Configuration must have at least one resource",
      configPath,
    );
  }
}

export function validateResourceStructure(
  resource: unknown,
  resourcePath: string,
): void {
  if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
    throw new ValidationError("Resource must be an object", resourcePath);
  }
}

export async function validateResource(
  resource: Resource,
  resourcePath = "resource",
): Promise<ValidatedResource> {
  validateResourceStructure(resource, resourcePath);
  validateResourceSource(resource, resourcePath);

  const overwrite = validateOverwrite(resource.overwrite, resourcePath);
  const outputs = validateOutputs(resource.outputs, resourcePath);

  const plugin = pluginRegistry.resolve(resource.plugin);
  if (plugin.validate) {
    try {
      await plugin.validate(resource.pluginConfig);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ValidationError(
        `Plugin validation failed: ${errorMessage}`,
        `${resourcePath}.pluginConfig`,
      );
    }
  }

  return {
    plugin: resource.plugin,
    pluginConfig: resource.pluginConfig,
    overwrite,
    outputs,
  };
}

export async function validateLocalPath(path: string): Promise<void> {
  try {
    const absolutePath = resolve(path);
    await stat(absolutePath);
  } catch (error) {
    handleNodeError(error, path, "validate");
  }
}
