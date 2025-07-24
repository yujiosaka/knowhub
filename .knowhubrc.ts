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
        url: "https://raw.githubusercontent.com/kinopeee/windsurfrules/refs/heads/main/v5-en/.windsurfrules",
      },
      overwrite: true,
      outputs: ".windsurf/rules/rules.md",
    },
    {
      plugin: "http",
      pluginConfig: {
        url: "https://gist.githubusercontent.com/yujiosaka/3c35711cc4198136c637bdb8b2806755/raw/15ea776c76f2962f67ecf6dd8df3f7e63705b792/CLAUDE.md",
      },
      overwrite: true,
      outputs: "CLAUDE.md",
    },
  ],
};

export default config;
