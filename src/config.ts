import { resolve } from "node:path";
import { cosmiconfig } from "cosmiconfig";
import { ConfigurationError, ValidationError } from "./errors.js";
import { pluginRegistry } from "./plugins/registry.js";
import { validateConfigStructure, validateResource } from "./validators.js";

/**
 * Configuration object for knowhub
 */
export interface Config {
  /** Plugin file paths for dynamic loading (optional) */
  plugins?: string[];

  /** Resources to synchronize */
  resources: Resource[];
}

/**
 * Definition of a single resource to be synchronized
 */
export interface Resource {
  /** Plugin name */
  plugin: string;

  /** Plugin-specific configuration */
  pluginConfig: unknown;

  /** Whether to overwrite existing files at output locations */
  overwrite?: boolean;

  /** Output destinations (relative to project root) */
  outputs: string | string[];
}

/**
 * A resource after it has been fetched/resolved
 */
export interface FetchedResource {
  /** Original resource definition */
  definition: ValidatedResource;

  /** Absolute local path (for local resources) */
  localPath?: string;

  /** Whether the local path is a directory */
  isDirectory?: boolean;

  /** Content from remote URL (for remote resources) */
  content?: string;

  /** Plugin-specific metadata */
  pluginMetadata?: Record<string, unknown>;
}

/**
 * Validated resource definition with normalized fields
 */
export interface ValidatedResource {
  plugin: string;
  pluginConfig: unknown;
  overwrite: boolean;
  outputs: string[];
}

export async function loadConfig(
  configPath?: string,
  projectRoot?: string,
): Promise<ValidatedResource[]> {
  const explorer = cosmiconfig("knowhub");

  let result:
    | Awaited<ReturnType<typeof explorer.search>>
    | Awaited<ReturnType<typeof explorer.load>>;
  if (configPath) {
    result = await explorer.load(configPath);
  } else {
    result = await explorer.search();
  }

  if (!result) {
    throw new ConfigurationError(
      'No knowhub configuration found. Run "npx knowhub init" to create a configuration file, or ensure you have a .knowhubrc.* file or "knowhub" field in package.json.',
      configPath,
    );
  }

  const config = result.config;

  try {
    validateConfigStructure(config, result.filepath);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ConfigurationError(error.message, result.filepath);
    }
    throw error;
  }

  if (config.plugins && Array.isArray(config.plugins)) {
    const configProjectRoot = projectRoot || process.cwd();
    try {
      await pluginRegistry.loadPlugins(config.plugins, configProjectRoot);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ConfigurationError(
        `Failed to load plugins: ${errorMessage}`,
        result.filepath,
      );
    }
  }

  const validatedResources: ValidatedResource[] = [];

  for (let i = 0; i < config.resources.length; i++) {
    const resource = config.resources[i];
    if (!resource) {
      throw new ValidationError(
        `Invalid resource at resources[${i}]: resource is undefined`,
        `resources[${i}]`,
      );
    }

    const resourcePath = `resources[${i}]`;

    try {
      const validated = await validateResource(resource, resourcePath);
      validatedResources.push(validated);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ValidationError(
        `Invalid resource at ${resourcePath}: ${errorMessage}`,
        resourcePath,
      );
    }
  }

  return validatedResources;
}
