export function isPluginResource(
  resource: unknown,
): resource is { plugin: string; pluginConfig: unknown } {
  if (typeof resource !== "object" || resource === null) {
    return false;
  }

  const obj = resource as Record<string, unknown>;
  return (
    "plugin" in obj && typeof obj.plugin === "string" && obj.plugin.length > 0
  );
}
