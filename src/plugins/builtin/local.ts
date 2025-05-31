import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { handleNodeError } from "../../errors.js";
import { PluginConfigurationError, PluginError } from "../errors.js";
import type {
  Plugin,
  PluginConfigSchema,
  PluginContext,
  PluginResult,
} from "../types.js";

/**
 * Configuration for the local plugin
 */
export interface LocalPluginConfig {
  /** Local filesystem path (file or directory) */
  path: string;
  /** Whether to create symlinks instead of copying */
  symlink?: boolean;
}

/**
 * Plugin for handling local filesystem resources
 * This maintains backward compatibility with existing `path` resources
 */
export class LocalPlugin implements Plugin {
  readonly name = "local";
  readonly version = "1.0.0";
  readonly description = "Fetch files and directories from local filesystem";

  readonly schema: PluginConfigSchema = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Local filesystem path (file or directory)",
      },
      symlink: {
        type: "boolean",
        description: "Whether to create symlinks instead of copying",
        default: false,
      },
    },
    required: ["path"],
    additionalProperties: false,
  };

  async validate(config: unknown): Promise<void> {
    if (!config || typeof config !== "object") {
      throw new PluginConfigurationError(
        this.name,
        "config",
        "must be an object",
      );
    }

    const localConfig = config as Record<string, unknown>;

    if (typeof localConfig.path !== "string" || localConfig.path.length === 0) {
      throw new PluginConfigurationError(
        this.name,
        "path",
        "must be a non-empty string",
      );
    }
  }

  async fetch(config: unknown, context: PluginContext): Promise<PluginResult> {
    await this.validate(config);

    const localConfig = config as LocalPluginConfig;
    const absolutePath = resolve(context.projectRoot, localConfig.path);

    try {
      const stats = await stat(absolutePath);
      const isDirectory = stats.isDirectory();

      return {
        localPath: absolutePath,
        isDirectory,
        metadata: {
          lastModified: stats.mtime,
          version: stats.mtime.toISOString(),
          symlink: localConfig.symlink || false,
        },
      };
    } catch (error) {
      try {
        handleNodeError(error, localConfig.path, "access local path");
      } catch (handledError) {
        const errorMessage =
          handledError instanceof Error
            ? handledError.message
            : String(handledError);
        throw new PluginError(
          `Failed to access local path "${localConfig.path}": ${errorMessage}`,
          this.name,
          handledError instanceof Error ? handledError : undefined,
        );
      }
    }
  }
}
