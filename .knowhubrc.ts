import type { Config } from "./src/index.js";

const config: Config = {
  resources: [
    {
      plugin: "http",
      pluginConfig: {
        url: "https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/refs/heads/main/rules/typescript-code-convention-cursorrules-prompt-file/general-project-rule.mdc",
      },
      overwrite: true,
      outputs: ".cursor/rules/general-project-rule.mdc",
    },
    {
      plugin: "http",
      pluginConfig: {
        url: "https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/refs/heads/main/rules/typescript-code-convention-cursorrules-prompt-file/general-typescript-rule.mdc",
      },
      overwrite: true,
      outputs: ".cursor/rules/general-typescript-rule.mdc",
    },
    {
      plugin: "http",
      pluginConfig: {
        url: "https://raw.githubusercontent.com/grapeot/devin.cursorrules/master/.github/copilot-instructions.md",
      },
      overwrite: true,
      outputs: ".github/copilot-instructions.md",
    },
    {
      plugin: "http",
      pluginConfig: {
        url: "https://raw.githubusercontent.com/grapeot/devin.cursorrules/master/.windsurfrules",
      },
      overwrite: true,
      outputs: ".windsurfrules",
    },
  ],
};

export default config;
