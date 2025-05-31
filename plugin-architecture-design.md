# knowhub Plugin Architecture Design

## Overview

This document outlines the implemented plugin architecture for knowhub that enables custom resource fetching from anywhere using a unified plugin-based approach.

## Architecture Goals

1. **Plugin-Only Architecture**: All resources use the plugin system for consistency and extensibility
2. **Extensibility**: Easy to add new resource types through plugins
3. **Type Safety**: Full TypeScript support with proper validation
4. **Performance**: Plugin-specific optimizations and caching
5. **Security**: Plugin-level authentication and validation
6. **User Experience**: Simple configuration with powerful capabilities

## Plugin System Design

### Core Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;
  fetch(config: unknown, context: PluginContext): Promise<PluginResult>;
  validate?(config: unknown): Promise<void>;
  schema?: PluginConfigSchema;
}

interface PluginContext {
  projectRoot: string;
  logger: Logger;
}

interface PluginResult {
  content?: string;        // For file content
  localPath?: string;      // For local files/directories
  isDirectory?: boolean;   // Whether result is a directory
  metadata?: PluginMetadata;
}

interface PluginMetadata {
  lastModified?: Date;
  etag?: string;
  version?: string;
  [key: string]: unknown;
}
```

### Resource Configuration Schema

```typescript
// All resources use the plugin-based format
interface Resource {
  plugin: string;               // Plugin name
  pluginConfig: unknown;        // Plugin-specific configuration
  overwrite?: boolean;          // Whether to overwrite existing files
  outputs: string | string[];   // Output file/directory paths
}

interface ValidatedResource {
  plugin: string;
  pluginConfig: unknown;
  overwrite: boolean;
  outputs: string[];
}
```

## Configuration Examples

### Built-in Plugin Resources

```yaml
# .knowhubrc.yaml
resources:
  # Local file using local plugin with symlink
  - plugin: 'local'
    pluginConfig:
      path: './shared-rules/style-guide.md'
      symlink: true
    outputs: ['.cursor/rules/style-guide.md']
  
  # Local file using local plugin with copy (default)
  - plugin: 'local'
    pluginConfig:
      path: './shared-components/README.md'
    outputs: ['docs/components.md']
  
  # HTTP URL using http plugin
  - plugin: 'http'
    pluginConfig:
      url: 'https://raw.githubusercontent.com/org/repo/main/config.json'
    outputs: ['config/remote.json']
  
  # Local directory
  - plugin: 'local'
    pluginConfig:
      path: './shared-components'
    outputs: ['src/components/shared']
```

### Future Plugin Examples

```yaml
# GitHub file fetching (to be implemented)
resources:
  - plugin: 'github'
    pluginConfig:
      owner: 'myorg'
      repo: 'coding-standards'
      path: 'rules/typescript-style.md'
      ref: 'main'
      token: '${GITHUB_TOKEN}'
    overwrite: true
    outputs:
      - '.cursor/rules/typescript-style.md'
      - 'docs/standards/typescript.md'
```

## Built-in Plugins

### 1. Local Plugin (`local`)
- Handles existing `path` resources
- Supports files and directories
- Symlink capabilities

### 2. HTTP Plugin (`http`)
- Handles existing `url` resources
- Advanced features: custom headers, authentication, timeouts
- Response caching and validation

### 3. GitHub Plugin (`github`)
- Fetch files and directories from GitHub repositories
- Support for public and private repositories
- Branch/tag/commit specification
- Authentication via personal access tokens
- GitHub Enterprise support

## Implemented Built-in Plugins

### 1. Local Plugin (`local`)
- **Purpose**: Handles local file and directory resources
- **Configuration**:
  ```typescript
  interface LocalPluginConfig {
    path: string;        // Local filesystem path (file or directory)
    symlink?: boolean;   // Whether to create symlinks instead of copying (default: false)
  }
  ```
- **Features**:
  - File and directory support
  - Relative path resolution from project root
  - Symlink support with `symlink: true` in plugin config
- **Examples**:
  ```yaml
  # Copy mode (default)
  - plugin: 'local'
    pluginConfig:
      path: './docs/rules.md'
    outputs: ['.cursor/rules.md']
  
  # Symlink mode
  - plugin: 'local'
    pluginConfig:
      path: './docs/rules.md'
      symlink: true
    outputs: ['.cursor/rules.md']
  ```

### 2. HTTP Plugin (`http`)
- **Purpose**: Handles HTTP/HTTPS URL resources
- **Configuration**:
  ```typescript
  interface HttpPluginConfig {
    url: string;         // HTTP/HTTPS URL to fetch
  }
  ```
- **Features**:
  - GET requests for file content
  - URL validation (http/https only)
  - Error handling for network issues
- **Example**:
  ```yaml
  - plugin: 'http'
    pluginConfig:
      url: 'https://example.com/config.json'
    outputs: ['config/remote.json']
  ```

## Future Plugin Implementation: GitHub

### Dependencies (when implemented)
```bash
npm install @octokit/rest
npm install --save-dev @types/node
```

### Configuration Schema (planned)
```typescript
interface GitHubPluginConfig {
  owner: string;           // Repository owner/organization
  repo: string;            // Repository name
  path: string;            // File or directory path in repo
  ref?: string;            // Branch, tag, or commit SHA (default: default branch)
  token?: string;          // GitHub personal access token
  baseUrl?: string;        // GitHub Enterprise base URL
}
```

## Implemented Plugin Registry System

```typescript
class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  
  register(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin);
  }
  
  resolve(name: string): Plugin {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Unknown plugin: ${name}`);
    }
    return plugin;
  }
  
  listAvailable(): string[] {
    return Array.from(this.plugins.keys());
  }
}

// Auto-registration of built-in plugins
export const pluginRegistry = new PluginRegistry();
pluginRegistry.register(localPlugin);
pluginRegistry.register(httpPlugin);
```

## Implemented Architecture

### File Structure
```
src/
├── plugins/
│   ├── types.ts              # Plugin interfaces and types
│   ├── index.ts              # Plugin exports and registry
│   ├── registry.ts           # Plugin registration and resolution
│   ├── helpers.ts            # Plugin helper utilities
│   └── builtin/
│       ├── local.ts          # Local file/directory plugin
│       └── http.ts           # HTTP/HTTPS plugin
├── config.ts                 # Plugin-only resource definitions
├── resource.ts               # Plugin-based resource fetching
├── validators.ts             # Plugin-only validation logic
├── commands/
│   └── sync.ts               # Updated sync command with logger passing
└── cli.ts                    # CLI with plugin system support
```

### Implementation Status

#### ✅ Completed
1. **Core Plugin Infrastructure**: All plugin types, interfaces, and registry implemented
2. **Built-in Plugins**: Local and HTTP plugins fully implemented and tested
3. **Plugin-Only Architecture**: Complete removal of legacy path/url support
4. **Resource Validation**: Unified validation system for plugin-only resources
5. **Logger Integration**: Proper logger passing throughout plugin system
6. **Test Coverage**: 178 tests passing with comprehensive plugin-only test suite

#### 🚧 Future Enhancements
1. **GitHub Plugin**: Octokit-based GitHub integration
2. **Plugin Configuration Schemas**: JSON Schema validation for plugin configs
3. **Advanced HTTP Features**: Headers, authentication, timeouts
4. **Plugin Caching**: Intelligent caching system for remote resources

## Implemented Validation & Error Handling

### Resource Validation
```typescript
export function validateResource(resource: Resource): ValidatedResource {
  // Validate resource structure
  validateResourceStructure(resource);
  
  // Validate plugin and configuration
  validateResourceSource(resource);
  
  // Validate common fields
  const symlink = validateSymlink(resource.symlink);
  const overwrite = validateOverwrite(resource.overwrite);
  const outputs = validateOutputs(resource.outputs);
  
  // Validate symlink compatibility
  validateSymlinkCompatibility(resource.plugin, symlink);
  
  return {
    plugin: resource.plugin,
    pluginConfig: resource.pluginConfig,
    symlink,
    overwrite,
    outputs
  };
}

function validateResourceSource(resource: Resource): void {
  if (!resource.plugin || typeof resource.plugin !== 'string' || resource.plugin.trim() === '') {
    throw new ValidationError('Plugin name is required and must be a non-empty string');
  }
  
  if (resource.pluginConfig === undefined) {
    throw new ValidationError('Plugin configuration is required');
  }
  
  // Validate plugin exists
  try {
    pluginRegistry.resolve(resource.plugin);
  } catch (error) {
    throw new ValidationError(`Unknown plugin: ${resource.plugin}`);
  }
}
```

### Error Types
```typescript
// Using existing error classes from errors.ts
export class ResourceError extends Error {
  constructor(message: string, public readonly resourcePath?: string) {
    super(message);
    this.name = 'ResourceError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

## Benefits

1. **Unified Architecture**: Single plugin-based approach for all resource types
2. **Plugin-Specific Configuration**: Each plugin manages its own options (e.g., symlink for local plugin)
3. **Type Safety**: Full TypeScript support with validation and autocomplete
4. **Performance**: Plugin-specific optimizations and intelligent caching
5. **Extensibility**: Easy to add new plugins for different services (GitLab, Bitbucket, S3, etc.)
6. **Security**: Plugin-level authentication and validation
7. **Developer Experience**: Clear interfaces and comprehensive error messages
8. **Clean Codebase**: Elimination of complex validation logic across different resource types

## Future Plugin Ideas

- **GitLab Plugin**: Fetch from GitLab repositories
- **Bitbucket Plugin**: Fetch from Bitbucket repositories
- **AWS S3 Plugin**: Fetch from S3 buckets
- **Google Drive Plugin**: Fetch from Google Drive
- **Database Plugin**: Fetch configuration from databases
- **Docker Plugin**: Extract files from Docker images
- **NPM Plugin**: Fetch files from NPM packages

This architecture provides a solid foundation for extensible resource fetching while maintaining the simplicity and reliability that makes knowhub valuable.