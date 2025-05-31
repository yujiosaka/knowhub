import type { Logger } from "../logger.js";

/**
 * Core plugin interface that all plugins must implement
 */
export interface Plugin {
  /** Unique name of the plugin */
  name: string;

  /** Plugin version */
  version: string;

  /** Human-readable description */
  description: string;

  /** Fetch resource using plugin-specific configuration */
  fetch(config: unknown, context: PluginContext): Promise<PluginResult>;

  /** Optional configuration validation */
  validate?(config: unknown): Promise<void>;

  /** Optional JSON schema for configuration validation */
  schema?: PluginConfigSchema;
}

/**
 * Context provided to plugins during execution
 */
export interface PluginContext {
  /** Absolute path to project root */
  projectRoot: string;

  /** Logger instance for plugin output */
  logger: Logger;
}

/**
 * Result returned by plugin fetch operations
 */
export interface PluginResult {
  /** Text content for file resources */
  content?: string;

  /** Local file system path for local resources */
  localPath?: string;

  /** Whether the result represents a directory */
  isDirectory?: boolean;

  /** Additional metadata from the plugin */
  metadata?: PluginMetadata;
}

/**
 * Additional metadata that plugins can provide
 */
export interface PluginMetadata {
  /** Last modification timestamp */
  lastModified?: Date;

  /** ETag or version identifier for caching */
  etag?: string;

  /** Resource version */
  version?: string;

  /** Plugin-specific metadata */
  [key: string]: unknown;
}

/**
 * JSON Schema definition for plugin configuration
 */
export interface PluginConfigSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}
