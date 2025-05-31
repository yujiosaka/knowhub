import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import type { FetchedResource } from "../config.js";
import { formatError } from "../errors.js";
import {
  copyDirectory,
  copyFile,
  symlinkOrCopy,
  writeTextFile,
} from "../file.js";
import type { Logger } from "../logger.js";
import { ConsoleLogger } from "../logger.js";
import { fetchResources } from "../resource.js";

interface SyncOptions {
  configPath?: string;
  dryRun?: boolean;
  quiet?: boolean;
  logger?: Logger;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function runSync(options: SyncOptions = {}): Promise<SyncResult> {
  const { configPath, dryRun = false, quiet = false, logger } = options;
  const actualLogger = logger || new ConsoleLogger(quiet);
  const projectRoot = process.cwd();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const resources = await loadConfig(configPath, projectRoot);
    const fetchedResources = await fetchResources(
      resources,
      projectRoot,
      actualLogger,
    );

    for (const fetchedResource of fetchedResources) {
      const result = await processFetchedResource(
        fetchedResource,
        projectRoot,
        dryRun,
        actualLogger,
      );
      created += result.created;
      updated += result.updated;
      skipped += result.skipped;
      errors.push(...result.errors);
    }

    printSummary({ created, updated, skipped, errors }, dryRun, actualLogger);

    return { created, updated, skipped, errors };
  } catch (error) {
    const errorMessage = formatError(error);
    actualLogger.error(`Error: ${errorMessage}`);
    errors.push(errorMessage);
    return { created, updated, skipped, errors };
  }
}

async function processFetchedResource(
  fetchedResource: FetchedResource,
  projectRoot: string,
  dryRun: boolean,
  logger: Logger,
): Promise<SyncResult> {
  const { definition } = fetchedResource;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const outputPath of definition.outputs) {
    try {
      const absoluteOutputPath = resolve(projectRoot, outputPath);

      if (dryRun) {
        logger.info(`[DRY RUN] Would process: ${outputPath}`);
        continue;
      }

      const result = await placeResourceAtOutput(
        fetchedResource,
        absoluteOutputPath,
      );

      created += result.created;
      updated += result.updated;

      if (result.created > 0) {
        logger.success(`✓ Created: ${outputPath}`);
      } else if (result.updated > 0) {
        logger.success(`✓ Updated: ${outputPath}`);
      } else {
        skipped++;
        if (!definition.overwrite) {
          logger.skip(
            `- Skipped: ${outputPath} (already exists, overwrite: false)`,
          );
        } else {
          logger.skip(`- Skipped: ${outputPath} (content identical)`);
        }
      }
    } catch (error) {
      const errorMessage = formatError(error);
      const fullError = `Failed to process output "${outputPath}": ${errorMessage}`;
      errors.push(fullError);
      logger.error(`✗ ${fullError}`);
    }
  }

  return { created, updated, skipped, errors };
}

async function placeResourceAtOutput(
  fetchedResource: FetchedResource,
  outputPath: string,
): Promise<{ created: number; updated: number }> {
  const { definition, localPath, isDirectory, content, pluginMetadata } =
    fetchedResource;
  const { overwrite } = definition;

  if (content !== undefined) {
    const result = await writeTextFile(outputPath, content, overwrite);
    return { created: result.created ? 1 : 0, updated: result.updated ? 1 : 0 };
  }

  if (localPath === undefined) {
    throw new Error("Local path is undefined for local resource");
  }

  const symlink =
    definition.plugin === "local" && pluginMetadata?.symlink === true;

  if (isDirectory) {
    if (symlink) {
      const result = await symlinkOrCopy(
        localPath,
        outputPath,
        overwrite,
        true,
      );
      return {
        created: result.created ? 1 : 0,
        updated: result.updated ? 1 : 0,
      };
    }

    const result = await copyDirectory(localPath, outputPath, overwrite);
    return { created: result.created, updated: 0 };
  }

  if (symlink) {
    const result = await symlinkOrCopy(localPath, outputPath, overwrite, false);
    return {
      created: result.created ? 1 : 0,
      updated: result.updated ? 1 : 0,
    };
  }

  const result = await copyFile(localPath, outputPath, overwrite);
  return {
    created: result.created ? 1 : 0,
    updated: result.updated ? 1 : 0,
  };
}

function printSummary(
  result: SyncResult,
  dryRun: boolean,
  logger: Logger,
): void {
  const { created, updated, skipped, errors } = result;
  const total = created + updated + skipped;

  logger.info(`\n${"=".repeat(50)}`);

  if (dryRun) {
    logger.info("DRY RUN SUMMARY");
  } else {
    logger.info("SYNC SUMMARY");
  }

  logger.info("=".repeat(50));
  logger.info(`Total outputs processed: ${total}`);
  logger.info(`Created: ${created}`);
  logger.info(`Updated: ${updated}`);
  logger.info(`Skipped: ${skipped}`);

  if (errors.length > 0) {
    logger.info(`Errors: ${errors.length}`);
    logger.info("\nErrors encountered:");
    for (const error of errors) {
      logger.info(`  • ${error}`);
    }
  }

  logger.info("=".repeat(50));

  if (errors.length === 0) {
    if (dryRun) {
      logger.success("✓ Dry run completed successfully");
    } else {
      logger.success("✓ Sync completed successfully");
    }
  } else {
    logger.warn("⚠ Sync completed with errors");
  }
}
