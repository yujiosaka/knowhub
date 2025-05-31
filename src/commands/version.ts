import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export default async function version(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const possiblePaths = [
    resolve(__dirname, "../../package.json"),
    resolve(__dirname, "../../../package.json"),
  ];

  let packageJson: { version?: string } | null = null;

  for (const packagePath of possiblePaths) {
    try {
      const content = await readFile(packagePath, "utf8");
      packageJson = JSON.parse(content);
      break;
    } catch {
      // Continue to next path if this one fails
    }
  }

  if (packageJson?.version) {
    console.log(`knowhub v${packageJson.version}`);
  } else {
    console.log("knowhub (version unknown)");
  }
}
