# knowhub [![npm version](https://badge.fury.io/js/knowhub.svg)](https://badge.fury.io/js/knowhub) [![CI/CD](https://github.com/yujiosaka/knowhub/actions/workflows/ci_cd.yml/badge.svg)](https://github.com/yujiosaka/knowhub/actions/workflows/ci_cd.yml)

###### [Code of Conduct](https://github.com/yujiosaka/knowhub/blob/main/docs/CODE_OF_CONDUCT.md) | [Contributing](https://github.com/yujiosaka/knowhub/blob/main/docs/CONTRIBUTING.md) | [Security](https://github.com/yujiosaka/knowhub/blob/main/docs/SECURITY.md) | [Changelog](https://github.com/yujiosaka/knowhub/blob/main/docs/CHANGELOG.md)

Synchronize AI coding–agent knowledge files (rules, templates, guidelines) across your project.

## What Is knowhub?

<img src="https://github.com/user-attachments/assets/7707f2e4-66bc-4f72-8531-fad4103c89ec" alt="icon" width="300" align="right">

**knowhub** is a lightweight CLI tool that synchronizes “resources” (local files, directories, or remote URLs) into one or more output locations within your project. It was designed with **AI coding agents** in mind—Cursor, Copilot, Windsurf, and more—so you can centrally manage coding guidelines, AI prompts, rule files, or shared snippets and distribute them across different directories without manual copying.

Running `npx knowhub` will:

1. **Load & validate** a single configuration.
2. **Fetch** each resource (from disk or over HTTP(S)).
3. **Place** each resource into all specified output paths by **copying** or **symlinking** (per your preference).

This ensures that any AI-agent rules, templates, or shared knowledge files stay in sync project-wide, with minimal overhead.

## Why knowhub?

* **AI Coding Agents Need Consistency:**  In large organizations, AI agents often rely on rule files (Cursor Rules, Copilot instructions, Windsurf settings, etc.) stored in project directories. Keeping those files up to date across multiple submodules or repos can be tedious.
* **Centralized Knowledge, Decentralized Usage:**  With knowhub, you place your master rules (Markdown, YAML, JSON, or any format) in a central folder (or even a remote URL), then declare where each AI agent expects its rules. knowhub handles distribution automatically.

## Key Features

* **Single-Command Synchronization:**  Run `npx knowhub` to fetch and place resources—no subcommands needed (aside from `init`).
* **Explicit Overwrite Control:**  Each resource can be configured with `overwrite: true | false`. If `false`, existing outputs remain untouched; if `true`, outputs are overwritten.
* **Copy or Symlink:**  Each resource's `symlink` property can be `true` (create symbolic links; auto-fallback to copy on Windows if symlinks aren't permitted) or `false`/omitted (duplicate files or directory trees).
* **Remote Content Support:**  Resources defined by `url` are fetched via HTTP(S) and written as text files.
* **Directory Tree Distribution:**  If a resource’s `path` points to a directory, knowhub can recursively copy or symlink that entire directory tree into each output folder.
* **Dry-Run Mode:**  Preview actions with `--dry-run` to see which files would be written or skipped, without modifying disk.

## Installation

Install **knowhub** as a development dependency:

```bash
npm install --save-dev knowhub
# or
yarn add --dev knowhub
# or
bun add --dev knowhub
```

## Configuration

knowhub searches for your configuration in these locations (in this order):

1. **`.knowhubrc`** (JSON or YAML)
2. **`.knowhubrc.json`**
3. **`.knowhubrc.yaml`** or **`.knowhubrc.yml`**
4. **`.knowhubrc.js`**
5. **`.knowhubrc.ts`**
6. **`package.json`**, under a top-level `"knowhub"` field

If multiple files exist, the one with highest precedence is loaded. If no configuration is found, knowhub exits with an error.

### `Resource` Schema

Each entry in the `resources` array must conform to this schema:

```ts
/**
 * One resource to be synchronized using the plugin architecture.
 *
 * - `plugin`: string (required) - Name of the plugin to use (e.g., "local", "http")
 * - `pluginConfig`: object (required) - Plugin-specific configuration
 * - `overwrite`: boolean (default: true) - Whether to overwrite existing files
 * - `outputs`: string or string[] (required) - Output destination paths
 */
export type Resource = {
  plugin: string;           // e.g. "local", "http", "github"
  pluginConfig: unknown;    // Plugin-specific configuration object
  overwrite?: boolean;      // Default: true
  outputs: string | string[];
};
```

### Built-in Plugins

**knowhub** comes with several built-in plugins:

#### **Local Plugin** (`"local"`)

Handles local filesystem resources (files and directories).

```ts
// Plugin configuration
interface LocalPluginConfig {
  path: string;       // Local filesystem path
  symlink?: boolean;  // Create symlinks instead of copying (default: false)
}
```

Example:
```yaml
- plugin: "local"
  pluginConfig:
    path: "./shared-rules/common-style.md"
    symlink: true
  overwrite: true
  outputs: [".cursor/rules/common-style.md"]
```

#### **HTTP Plugin** (`"http"`)

Fetches resources from HTTP(S) URLs with advanced features.

```ts
// Plugin configuration
interface HttpPluginConfig {
  url: string;                    // HTTP(S) URL to fetch
  headers?: Record<string, string>; // Custom headers
  timeout?: number;               // Timeout in milliseconds (default: 30000)
  method?: string;                // HTTP method (default: "GET")
  body?: string;                  // Request body for POST/PUT
}
```

Example:
```yaml
- plugin: "http"
  pluginConfig:
    url: "https://example.com/api-spec.json"
    headers:
      Authorization: "Bearer ${API_TOKEN}"
      Accept: "application/json"
    timeout: 10000
  overwrite: true
  outputs: ["src/assets/api-spec.json"]
```

### Sample Config

Below is a minimal `.knowhubrc.yaml` that demonstrates common use cases:

```yaml
# .knowhubrc.yaml

resources:
  # 1) Local Markdown file, symlink to two outputs, overwrite if exists
  - plugin: "local"
    pluginConfig:
      path: './shared-rules/common-style.md'
      symlink: true
    overwrite: true
    outputs:
      - '.cursor/rules/common-style.md'
      - '.github/copilot-instructions.md'

  # 2) Remote YAML (URL), copy to two outputs, skip overwriting existing files
  - plugin: "http"
    pluginConfig:
      url: 'https://raw.githubusercontent.com/YourOrg/ai-rules/main/security-guidelines.yaml'
    overwrite: false
    outputs:
      - '.windsurfrules'
      - 'docs/ai/security-guidelines.yaml'

  # 3) Local UI widgets directory, recursively copy into output, overwrite existing
  - plugin: "local"
    pluginConfig:
      path: './shared-rules/ui-widgets'
    overwrite: true
    outputs:
      - 'components/ui-widgets'

  # 4) Local PDF, copy and overwrite
  - plugin: "local"
    pluginConfig:
      path: './shared-rules/compliance.pdf'
    overwrite: true
    outputs:
      - 'docs/ai/compliance.pdf'

  # 5) Remote JSON with custom headers
  - plugin: "http"
    pluginConfig:
      url: 'https://example.com/api-spec.json'
      headers:
        Authorization: "Bearer ${API_TOKEN}"
        Accept: "application/json"
      timeout: 10000
    overwrite: true
    outputs:
      - 'src/assets/api-spec.json'
```

You can also place this in a TypeScript file (`.knowhubrc.ts`) or JSON (`.knowhubrc.json`) with the same structure:

```ts
// .knowhubrc.ts
import type { Config } from 'knowhub';

const config: Config = {
  resources: [
    {
      plugin: "local",
      pluginConfig: {
        path: './shared-rules/common-style.md',
        symlink: true,
      },
      overwrite: true,
      outputs: ['.cursor/rules/common-style.md', '.github/copilot-instructions.md'],
    },
    {
      plugin: "http",
      pluginConfig: {
        url: 'https://raw.githubusercontent.com/YourOrg/ai-rules/main/security-guidelines.yaml',
      },
      overwrite: false,
      outputs: ['.windsurfrules', 'docs/ai/security-guidelines.yaml'],
    },
    {
      plugin: "local",
      pluginConfig: {
        path: './shared-rules/ui-widgets',
      },
      overwrite: true,
      outputs: ['components/ui-widgets'],
    },
    {
      plugin: "local",
      pluginConfig: {
        path: './shared-rules/compliance.pdf',
      },
      overwrite: true,
      outputs: ['docs/ai/compliance.pdf'],
    },
    {
      plugin: "http",
      pluginConfig: {
        url: 'https://example.com/api-spec.json',
        headers: {
          Authorization: "Bearer ${API_TOKEN}",
          Accept: "application/json",
        },
        timeout: 10000,
      },
      overwrite: true,
      outputs: ['src/assets/api-spec.json'],
    },
  ],
};

export default config;
```

## Usage

### `npx knowhub`

Simply run this in your project root:

```bash
npx knowhub
```

The tool will:

1. **Find** and **load** your configuration.
2. **Validate** that each resource has a valid `plugin` name, proper `pluginConfig`, a boolean `overwrite` (defaults to `true`), and one or more `outputs`.
3. **Fetch** each resource using the specified plugin:

   * **Local plugin**: Resolves files or directories on disk, optionally creating symlinks.
   * **HTTP plugin**: Performs HTTP requests with custom headers, timeouts, and authentication.
   * **Custom plugins**: Any registered plugins with their specific fetch logic.
4. **Copy, Symlink, or Write** each resource into every output path:

   * **Local files** → copy or create symlinks based on plugin configuration; respect `overwrite`.
   * **Local directories** → recursively copy or create directory symlinks; respect `overwrite`.
   * **Remote content** → write the fetched content into each output file; respect `overwrite`.
5. **Print Summary**:

   * Number of outputs created (new files/directories).
   * Number of outputs updated (existing files/directories overwritten).
   * Number of outputs skipped because they already existed and `overwrite: false` or content is identical.

> **Dry-run preview**: To see what would happen without modifying anything, run:
>
> ```bash
> npx knowhub --dry-run
> ```
>
> This prints, for each resource and output, whether it would copy, symlink, or skip.

> **Quiet mode**: To suppress all output (useful for CI/CD), run:
>
> ```bash
> npx knowhub --quiet
> ```

> **Custom config path**: If your config file is not in the default location, specify:
>
> ```bash
> npx knowhub --config ./config/my-knowhub.yaml
> ```

## Examples

### Sync Cursor Rules

Suppose you maintain a centralized set of Cursor Rules in a shared folder (`./ai-rules/cursor`). To distribute them to each project’s `.cursor/rules` folder:

```yaml
# .knowhubrc.yaml
resources:
  - plugin: "local"
    pluginConfig:
      path: './ai-rules/cursor'
    overwrite: true
    outputs:
      - '.cursor/rules'
```

Running `npx knowhub` will recursively copy everything under `./ai-rules/cursor/*` into `.cursor/rules/*`.

### Share Copilot Instructions

If you keep your Copilot instruction file in a single location (`./ai-rules/copilot/instructions.md`), and you want to place it in `.github/copilot-instructions.md`:

```yaml
resources:
  - plugin: "local"
    pluginConfig:
      path: './ai-rules/copilot/instructions.md'
      symlink: true
    overwrite: true
    outputs:
      - '.github/copilot-instructions.md'
```

On POSIX systems, this will create a symlink:

```
.github/copilot-instructions.md → ../ai-rules/copilot/instructions.md
```

On Windows, if symlinks aren't allowed, it will copy the file instead.

### Distribute Windsurf Settings

If your Windsurf configuration is hosted remotely:

```yaml
resources:
  - plugin: "http"
    pluginConfig:
      url: 'https://raw.githubusercontent.com/YourOrg/ai-rules/main/windsurf-config.yaml'
    overwrite: false
    outputs:
      - '.windsurfrules'
      - 'docs/ai/windsurf-config.yaml'
```

Running `npx knowhub` will fetch the YAML text and write it to `.windsurfrules` and `docs/ai/windsurf-config.yaml`, unless those files already exist.

### Copy Entire Directory Trees

To copy a folder of AI prompt templates (`./ai-templates`) into two places:

```yaml
resources:
  - plugin: "local"
    pluginConfig:
      path: './ai-templates'
    overwrite: true
    outputs:
      - 'src/ai/prompt-templates'
      - 'docs/ai/prompt-templates'
```

This recursively copies all files and subdirectories from `./ai-templates/*` into `src/ai/prompt-templates/*` and `docs/ai/prompt-templates/*`.

### Advanced HTTP Requests

For APIs requiring authentication or custom headers:

```yaml
resources:
  - plugin: "http"
    pluginConfig:
      url: 'https://api.internal.com/config.json'
      headers:
        Authorization: "Bearer ${API_TOKEN}"
        X-Team: "frontend"
        Accept: "application/json"
      timeout: 15000
    overwrite: true
    outputs:
      - 'config/api-settings.json'
```

This fetches from an authenticated API with custom headers and a 15-second timeout.

## CI/CD Integration

Integrate **knowhub** into your continuous-integration pipeline to ensure that generated outputs remain in sync with your configuration. For example, in GitHub Actions:

```yaml
name: Sync AI Agent Knowledge

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  sync-ai-agent-knowledge:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Run knowhub
        run: npx knowhub

      - name: Commit updated outputs
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add .
          git diff --quiet || git commit -m "chore: update AI agent knowledge files"
          git push
```

* **Run** `npx knowhub` to update all outputs.
* **Commit** and **push** any new or changed files so your repository always has the latest AI prompts, rules, or guidelines.

## Custom Plugins

knowhub supports a powerful plugin system that allows you to extend its functionality with custom resource fetchers. You can create plugins to fetch from APIs, databases, cloud services, or any other data source.

### Dynamic Plugin Loading

knowhub automatically loads plugins specified in your configuration, eliminating the need for manual registration:

```yaml
# .knowhubrc.yaml
plugins:
  - "./plugins/github-plugin.ts"
  - "./plugins/my-custom-plugin.js"
  - "./node_modules/knowhub-slack-plugin"

resources:
  - plugin: "github"
    pluginConfig:
      owner: "company"
      repo: "standards"
      path: "rules.md"
      token: "${GITHUB_TOKEN}"
    outputs: [".cursor/rules.md"]
```

### Plugin Configuration

Add custom plugins to your knowhub configuration using the `plugins` field:

- **Local plugins**: Relative paths to your plugin files (`.ts`, `.js`)
- **NPM packages**: Node module names that export knowhub plugins
- **Multiple export patterns**: Supports both default and named exports

Example with multiple plugin types:

```typescript
// .knowhubrc.ts
import type { Config } from 'knowhub';

const config: Config = {
  plugins: [
    "./plugins/github-plugin.ts",        // Local TypeScript plugin
    "./plugins/slack-plugin.js",         // Local JavaScript plugin
    "knowhub-jira-plugin",               // NPM package plugin
  ],
  resources: [
    {
      plugin: "github",
      pluginConfig: {
        owner: "company",
        repo: "coding-standards",
        path: "cursor-rules.md",
        token: process.env.GITHUB_TOKEN,
      },
      outputs: [".cursor/rules.md"],
    },
    {
      plugin: "slack",
      pluginConfig: {
        channel: "engineering",
        messageId: "12345",
        token: process.env.SLACK_TOKEN,
      },
      outputs: ["docs/announcements.md"],
    },
  ],
};

export default config;
```

### Available Plugins

- **Built-in plugins**: `local` (filesystem), `http` (HTTP/HTTPS requests)
- **Example plugins**: See the [`examples/`](examples) directory for plugin development guides and sample implementations
- **Community plugins**: Check npm for community-contributed knowhub plugins

### Creating Custom Plugins

For detailed instructions on creating your own plugins, including a complete GitHub plugin example, see the [**Plugin Development Guide**](examples/README.md) in the `examples/` directory.

The guide covers:
- Plugin architecture and interfaces
- Dynamic loading setup
- Configuration validation
- Error handling best practices
- Complete working examples

## License

This project is licensed under the **MIT License**. See the [LICENSE](https://github.com/yujiosaka/knowhub/blob/main/LICENSE) file for details.
