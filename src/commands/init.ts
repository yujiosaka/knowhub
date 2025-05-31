import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_FILES = [
  ".knowhubrc.ts",
  ".knowhubrc.js",
  ".knowhubrc.json",
  ".knowhubrc.yaml",
  ".knowhubrc.yml",
  ".knowhubrc",
];

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export default async function init(): Promise<void> {
  try {
    for (const configFile of CONFIG_FILES) {
      if (await pathExists(resolve(configFile))) {
        throw new Error(`Configuration file already exists: ${configFile}`);
      }
    }

    if (await pathExists("package.json")) {
      try {
        const packageContent = await readFile("package.json", "utf8");
        const packageJson = JSON.parse(packageContent);
        if (packageJson.knowhub) {
          throw new Error(
            'Configuration already exists in package.json under "knowhub" field',
          );
        }
      } catch (error) {
        // Ignore JSON parse errors, continue with template creation
      }
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const possibleTemplatePaths = [
      resolve(__dirname, "../../templates/.knowhubrc.template.ts"),
      resolve(__dirname, "../../../templates/.knowhubrc.template.ts"),
    ];

    let templatePath: string | null = null;
    for (const path of possibleTemplatePaths) {
      if (await pathExists(path)) {
        templatePath = path;
        break;
      }
    }

    if (!templatePath) {
      throw new Error("Could not find configuration template file");
    }

    const template = await readFile(templatePath, "utf8");

    await writeFile(".knowhubrc.ts", template, "utf8");

    console.log("✓ Configuration template created successfully");
    console.log(
      'Edit your configuration file and run "npx knowhub" to sync resources',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to create configuration template: ${errorMessage}`);
    process.exit(1);
  }
}
