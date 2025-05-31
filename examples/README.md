# Custom Plugin Development Guide

This guide explains how to create custom plugins for knowhub and provides a comprehensive example with the GitHub plugin.

## Plugin Architecture Overview

knowhub uses a flexible plugin system that allows you to extend its functionality with custom resource fetchers. Each plugin implements the `Plugin` interface and can handle specific resource types.

### Plugin Interface

```typescript
import type {
  Plugin,
  PluginConfigSchema,
  PluginContext,
  PluginResult,
} from "knowhub";

export class MyCustomPlugin implements Plugin {
  readonly name = "my-plugin";           // Unique plugin identifier
  readonly version = "1.0.0";            // Plugin version
  readonly description = "Description";   // Plugin description
  readonly schema: PluginConfigSchema;    // JSON schema for configuration

  async validate(config: unknown): Promise<void> {
    // Validate plugin configuration
  }

  async fetch(config: unknown, context: PluginContext): Promise<PluginResult> {
    // Fetch resource and return result
  }
}
```

### Plugin Registration

knowhub supports two ways to register plugins:

#### 1. Dynamic Plugin Loading (Recommended)

Add your plugin paths to your knowhub configuration:

```yaml
# .knowhubrc.yaml
plugins:
  - "./plugins/my-custom-plugin.ts"
  - "./plugins/github-plugin.ts"

resources:
  - plugin: "my-plugin"
    pluginConfig:
      # Plugin-specific configuration
    outputs: ["output/path"]
```

Your plugin file should export either:
- **Default export**: `export default class MyPlugin implements Plugin {}`
- **Named export**: `export class MyPlugin implements Plugin {}`
- **Instance export**: `export default new MyPlugin()`

#### 2. Manual Registration (Legacy)

```typescript
import { pluginRegistry } from 'knowhub';
import { MyCustomPlugin } from './plugins/my-custom-plugin.js';

pluginRegistry.register(new MyCustomPlugin());
```

## Creating a Custom Plugin

### Step 1: Define Plugin Configuration

```typescript
interface MyPluginConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
}
```

### Step 2: Implement the Plugin

```typescript
import type {
  Plugin,
  PluginConfigSchema,
  PluginContext,
  PluginResult,
} from "knowhub";
import { PluginConfigurationError, PluginError } from "knowhub";

export default class MyCustomPlugin implements Plugin {
  readonly name = "my-plugin";
  readonly version = "1.0.0";
  readonly description = "Fetches resources from a custom API";

  readonly schema: PluginConfigSchema = {
    type: "object",
    properties: {
      url: { type: "string", description: "API endpoint URL" },
      apiKey: { type: "string", description: "API key for authentication" },
      timeout: { type: "number", description: "Request timeout in milliseconds" },
    },
    required: ["url"],
    additionalProperties: false,
  };

  async validate(config: unknown): Promise<void> {
    if (!config || typeof config !== "object") {
      throw new PluginConfigurationError(
        this.name,
        "config",
        "must be an object"
      );
    }

    const myConfig = config as Record<string, unknown>;

    if (typeof myConfig.url !== "string" || !myConfig.url) {
      throw new PluginConfigurationError(
        this.name,
        "url",
        "must be a non-empty string"
      );
    }
  }

  async fetch(config: unknown, context: PluginContext): Promise<PluginResult> {
    await this.validate(config);

    const myConfig = config as MyPluginConfig;
    
    try {
      // Implement your fetching logic here
      const response = await fetch(myConfig.url, {
        headers: myConfig.apiKey ? { 'Authorization': `Bearer ${myConfig.apiKey}` } : {},
        timeout: myConfig.timeout || 30000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();

      context.logger.info(`Successfully fetched from ${myConfig.url}`);

      return {
        content,
        isDirectory: false,
        metadata: {
          lastModified: new Date(),
          size: content.length,
          url: myConfig.url,
        },
      };
    } catch (error) {
      throw new PluginError(
        `Failed to fetch from ${myConfig.url}: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }
}
```

### Step 3: Use Your Plugin

```yaml
# .knowhubrc.yaml
plugins:
  - "./plugins/my-custom-plugin.ts"

resources:
  - plugin: "my-plugin"
    pluginConfig:
      url: "https://api.example.com/config.json"
      apiKey: "${API_KEY}"
      timeout: 10000
    outputs: ["config/api-settings.json"]
```

## GitHub Plugin Example

The GitHub plugin demonstrates a complete implementation for fetching files and directories from GitHub repositories. It supports both public and private repositories, authentication, and various GitHub features.

### GitHub Plugin Features

- **File and Directory Fetching**: Download individual files or entire directories
- **Authentication Support**: Works with personal access tokens for private repositories
- **GitHub Enterprise**: Supports custom GitHub Enterprise installations
- **Version Control**: Fetch from specific branches, tags, or commit SHAs
- **Error Handling**: Comprehensive error messages for common GitHub API issues

### Installation

1. **Install the Octokit dependency** in your project:
   ```bash
   npm install @octokit/rest
   ```

2. **Copy the GitHub plugin** from [`examples/github-plugin.ts`](github-plugin.ts:1) to your project

3. **Configure dynamic loading** in your knowhub configuration:
   ```yaml
   plugins:
     - "./plugins/github-plugin.ts"
   ```

### Configuration Examples

#### Basic File Fetching

```yaml
# .knowhubrc.yaml
plugins:
  - "./examples/github-plugin.ts"

resources:
  # Fetch a single file from GitHub
  - plugin: 'github'
    pluginConfig:
      owner: 'company'
      repo: 'coding-standards'
      path: 'rules/typescript-style.md'
      ref: 'main'
      token: '${GITHUB_TOKEN}'  # Environment variable
    outputs: ['.cursor/rules/typescript.md']
    overwrite: true
```

#### Overwriting Existing Rules

```yaml
resources:
  # Overwrite cursor rules with latest from GitHub
  - plugin: 'github'
    pluginConfig:
      owner: 'myorg'
      repo: 'development-standards'
      path: 'cursor/rules.md'
      ref: 'main'
      token: '${GITHUB_TOKEN}'
    overwrite: true  # This will replace existing .cursor/rules.md
    outputs: ['.cursor/rules.md']

  # Fetch multiple files to different locations
  - plugin: 'github'
    pluginConfig:
      owner: 'myorg'
      repo: 'eslint-config'
      path: '.eslintrc.json'
      ref: 'v2.1.0'  # Use specific version
      token: '${GITHUB_TOKEN}'
    overwrite: true
    outputs:
      - '.eslintrc.json'
      - 'config/eslint-base.json'
```

#### Fetching Entire Directories

```yaml
resources:
  # Fetch entire UI component library
  - plugin: 'github'
    pluginConfig:
      owner: 'company'
      repo: 'design-system'
      path: 'components/ui'  # Entire directory
      ref: 'v3.2.0'
      token: '${GITHUB_TOKEN}'
    overwrite: true
    outputs: ['src/shared/components']

  # Fetch documentation directory
  - plugin: 'github'
    pluginConfig:
      owner: 'company'
      repo: 'engineering-docs'
      path: 'standards'
      ref: 'main'
      token: '${GITHUB_TOKEN}'
    overwrite: false  # Don't overwrite existing docs
    outputs: ['docs/standards']
```

### Authentication

#### Using Personal Access Tokens

1. **Create a GitHub Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a new token with appropriate scopes (repo access for private repos)

2. **Set the environment variable:**
   ```bash
   export GITHUB_TOKEN=your_token_here
   ```

3. **Reference in configuration:**
   ```yaml
   pluginConfig:
     token: '${GITHUB_TOKEN}'
   ```

#### For GitHub Enterprise

```yaml
pluginConfig:
  owner: 'company'
  repo: 'standards'
  path: 'rules.md'
  token: '${GITHUB_TOKEN}'
  baseUrl: 'https://github.company.com/api/v3'  # Enterprise URL
```

### Advanced Usage

#### Version Pinning

```yaml
# Pin to specific commit SHA
pluginConfig:
  owner: 'company'
  repo: 'standards'
  path: 'rules.md'
  ref: 'a1b2c3d4e5f6'  # Specific commit
  token: '${GITHUB_TOKEN}'
```

#### Public Repositories

```yaml
# No token needed for public repos
pluginConfig:
  owner: 'microsoft'
  repo: 'TypeScript'
  path: 'README.md'
  # token not required for public repos
```

### Error Handling

The GitHub plugin provides detailed error messages:

- **404 errors**: Repository, path, or ref not found
- **401 errors**: Authentication failed (check token)
- **403 errors**: Access forbidden (check permissions)
- **Rate limiting**: Plugin handles GitHub API rate limits

## Complete Example Project Setup

1. **Install dependencies:**
   ```bash
   npm install knowhub @octokit/rest
   ```

2. **Create plugin file** (`plugins/github-plugin.ts`):
   ```typescript
   // Copy the complete GitHubPlugin class from examples/github-plugin.ts
   ```

3. **Create configuration** (`.knowhubrc.yaml`):
   ```yaml
   plugins:
     - "./plugins/github-plugin.ts"
   
   resources:
     - plugin: 'github'
       pluginConfig:
         owner: 'company'
         repo: 'standards'
         path: 'cursor-rules.md'
         token: '${GITHUB_TOKEN}'
       overwrite: true
       outputs: ['.cursor/rules.md']
   ```

4. **Run knowhub:**
   ```bash
   npx knowhub
   ```

This setup allows you to fetch and overwrite files from GitHub repositories seamlessly within your knowhub workflow using the modern dynamic plugin loading system.

## Best Practices

1. **Error Handling**: Always use `PluginError` and `PluginConfigurationError` for proper error reporting
2. **Validation**: Implement thorough configuration validation in the `validate()` method
3. **Logging**: Use `context.logger` to provide informative messages
4. **Environment Variables**: Support environment variable substitution for sensitive data
5. **Metadata**: Include relevant metadata in your `PluginResult` for debugging and caching
6. **TypeScript**: Use proper TypeScript types for better development experience