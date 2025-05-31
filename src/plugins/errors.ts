/**
 * Error thrown when plugin operations fail
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly cause?: Error,
  ) {
    super(`Plugin "${pluginName}": ${message}`);
    this.name = "PluginError";
  }
}

/**
 * Error thrown when plugin configuration is invalid
 */
export class PluginConfigurationError extends PluginError {
  constructor(pluginName: string, field: string, message: string) {
    super(`Invalid configuration for field "${field}": ${message}`, pluginName);
    this.name = "PluginConfigurationError";
  }
}

/**
 * Error thrown when plugin is not found
 */
export class PluginNotFoundError extends Error {
  constructor(pluginName: string) {
    super(`Plugin not found: ${pluginName}`);
    this.name = "PluginNotFoundError";
  }
}
