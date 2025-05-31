// This template file uses "knowhub" import which will be resolved
// when users install the package in their projects
// @ts-ignore - This import will work for end users who have installed knowhub
import type { Config } from "knowhub";

const config: Config = {
  resources: [
    // Example 1: Local file symlinked to multiple locations
    {
      plugin: "local",
      pluginConfig: {
        path: "./shared-rules/common-style.md",
        symlink: true,
      },
      overwrite: true,
      outputs: [
        ".cursor/rules/common-style.md",
        ".github/copilot-instructions.md",
      ],
    },

    // Example 2: Remote file copied to local locations
    {
      plugin: "http",
      pluginConfig: {
        url: "https://raw.githubusercontent.com/YourOrg/ai-rules/main/security-guidelines.yaml",
      },
      overwrite: false, // Don't overwrite if already exists
      outputs: [".windsurfrules", "docs/ai/security-guidelines.yaml"],
    },

    // Example 3: Local directory copied to output location
    {
      plugin: "local",
      pluginConfig: {
        path: "./shared-rules/ui-widgets",
      },
      overwrite: true,
      outputs: ["components/ui-widgets"],
    },

    // Example 4: Remote JSON file with custom headers
    {
      plugin: "http",
      pluginConfig: {
        url: "https://example.com/api-spec.json",
        headers: {
          Accept: "application/json",
          "User-Agent": "knowhub/1.0.0",
        },
        timeout: 10000,
      },
      overwrite: true,
      outputs: ["src/assets/api-spec.json"],
    },
  ],
};

export default config;
