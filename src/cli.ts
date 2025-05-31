import { parseArgs } from "node:util";
import { help, init, runSync, version } from "./commands/index.js";

export default async function cli(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      config: {
        type: "string",
        short: "c",
      },
      "dry-run": {
        type: "boolean",
        short: "d",
      },
      quiet: {
        type: "boolean",
        short: "q",
      },
      help: {
        type: "boolean",
        short: "h",
      },
      version: {
        type: "boolean",
        short: "v",
      },
    },
    allowPositionals: true,
  });

  if (values.help) {
    help();
    return;
  }

  if (values.version) {
    await version();
    return;
  }

  const command = positionals[0];

  try {
    if (command === "init") {
      await init();
    } else if (command === undefined) {
      await runSync({
        configPath: values.config,
        dryRun: values["dry-run"],
        quiet: values.quiet,
      });
    } else {
      console.error(`Unknown command: ${command}`);
      help();
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}
