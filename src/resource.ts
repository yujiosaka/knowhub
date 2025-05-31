import type { FetchedResource, ValidatedResource } from "./config.js";
import { ResourceError, formatError, handleNodeError } from "./errors.js";
import type { Logger } from "./logger.js";
import { ConsoleLogger } from "./logger.js";
import { pluginRegistry } from "./plugins/index.js";
import type { PluginContext } from "./plugins/index.js";

export async function fetchResources(
  resources: ValidatedResource[],
  projectRoot: string = process.cwd(),
  logger?: Logger,
): Promise<FetchedResource[]> {
  const fetchedResources: FetchedResource[] = [];

  for (const definition of resources) {
    try {
      const fetched = await fetchSingleResource(
        definition,
        projectRoot,
        logger,
      );
      fetchedResources.push(fetched);
    } catch (error) {
      if (error instanceof ResourceError) {
        throw error;
      }
      const errorMessage = formatError(error);
      throw new ResourceError(`Failed to fetch resource: ${errorMessage}`);
    }
  }

  return fetchedResources;
}

async function fetchSingleResource(
  definition: ValidatedResource,
  projectRoot: string,
  logger?: Logger,
): Promise<FetchedResource> {
  const plugin = pluginRegistry.resolve(definition.plugin);

  const context: PluginContext = {
    projectRoot,
    logger: logger || new ConsoleLogger(),
  };

  try {
    const result = await plugin.fetch(definition.pluginConfig, context);

    return {
      definition,
      localPath: result.localPath,
      isDirectory: result.isDirectory || false,
      content: result.content,
      pluginMetadata: result.metadata,
    };
  } catch (error) {
    if (error instanceof ResourceError) {
      throw error;
    }
    const errorMessage = formatError(error);
    throw new ResourceError(
      `Failed to fetch with plugin "${definition.plugin}": ${errorMessage}`,
      definition.plugin,
    );
  }
}
