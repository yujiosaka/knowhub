# knowhub: High-Level Design

**Purpose:**
`knowhub` is a CLI tool that, when run in a project’s root directory (via `npx knowhub`), automatically synchronizes a set of “resource” definitions—each representing either a local file/directory or a remote URL—into one or more output destinations inside the same project. It never deletes existing files; outputs are either overwritten (if allowed) or left untouched. It also supports copying entire directory trees. Configuration is loaded flexibly via [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig), so you can place your configuration in any supported format (`.js`, `.ts`, `.json`, `.yaml`/`.yml`, or even a `package.json` “knowhub” field).

---

## 1. Overview

1. **Configuration Discoverable by Cosmiconfig**

   * `knowhub` uses [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig) to locate and load a configuration object named  `"knowhub"`.
   * That means you can put your configuration in any of the following (in order of preference):

     * A file named `.knowhubrc` (with no extension, if it contains JSON/YAML).
     * `.knowhubrc.json`, `.knowhubrc.yaml` / `.yml`, `.knowhubrc.js`, `.knowhubrc.ts`.
     * A `knowhub` property in your project’s `package.json`.
     * (Cosmiconfig also supports other file types, like `.cjs`, `.mjs`, etc., as long as they export a `knowhub`-named object.)
   * No matter which file format you choose, `knowhub` will find it automatically.

2. **Single “Sync” Command (No Subcommands)**

   * Running `npx knowhub` (without subcommands) does all of the following in sequence:

     1. **Load and validate** the configuration.
     2. **Fetch** each resource (from disk or from URL).
     3. **Copy or symlink** each resource (file or directory) into the configured output paths, honoring each resource’s `overwrite` flag.
     4. **Exit** successfully (never deleting existing files).

3. **No Cleanup/Deletion of Outputs**

   * Unlike other tools, `knowhub` does **not** remove any files that previously existed.
   * If a resource’s outputs have changed, old files remain on disk—`knowhub` either skips (if `overwrite: false`) or overwrites (if `overwrite: true`) each individual output path.

4. **Full Directory Support**

   * If a resource’s `path` points to a directory (instead of a single file), `knowhub` will copy (or symlink) that entire directory tree under each specified output destination.
   * For example, if `path: "./shared-rules/ui-widgets"` and `outputs: ["components/ui-widgets"]`, then all files/subdirectories under `./shared-rules/ui-widgets/*` will be recursively copied (or symlinked) into `components/ui-widgets/*`.

5. **Overwrite Control**

   * Each resource entry has an `overwrite` boolean (default: `true`).
   * When writing a file or directory tree into an output location:

     * If `overwrite: true`, existing files at that location are replaced.
     * If `overwrite: false`, existing files or directories are left intact and only missing items are created.

6. **Copy vs. Symlink**

   * Each resource also has a `symlink` property (boolean, defaults to `false`).
   * If `symlink: false` (or omitted), `knowhub` always duplicates the file or entire directory tree into each output.
   * If `symlink: true` and the resource is a **file**, `knowhub` attempts to create a symbolic link at each output path pointing directly back to the original local file; if symlink creation fails (e.g. on Windows without privileges), `knowhub` falls back to copying.
   * If `symlink: true` and the resource is a **directory**, `knowhub` attempts to create a symlink from each output directory to the original directory; if that fails, it falls back to a full recursive copy of the directory tree.
   * Note: `symlink: true` can only be used with local `path` resources, not with remote `url` resources.

---

## 2. Configuration File

### 2.1 Where to Put It

Place **any** of the following in your project root (and commit it):

* `.knowhubrc` (JSON or YAML)
* `.knowhubrc.json`
* `.knowhubrc.yaml` or `.knowhubrc.yml`
* `.knowhubrc.js`
* `.knowhubrc.ts`
* Or add a `"knowhub"` field in your `package.json`.

`knowhub` will use [`cosmiconfig("knowhub")`](https://github.com/davidtheclark/cosmiconfig) to discover and load whichever file exists (in the above order).

### 2.2 What It Looks Like

Regardless of file extension or format, the configuration object must look like this (in JavaScript/TypeScript notation):

```ts
// Example in TypeScript (knowledge-bridge.config.ts → .knowhubrc.ts)

import type { Config } from 'knowhub';

const config: Config = {
  resources: [
    /* 1) Local file, symlinked to two places; overwrite if exists */
    {
      path: './shared-rules/common-style.md',
      symlink: true,
      overwrite: true,
      outputs: [
        '.cursor/rules/common-style.md',
        '.github/copilot-instructions.md',
      ],
    },

    /* 2) Remote YAML, copied to two places; skip if already exists */
    {
      url: 'https://raw.githubusercontent.com/YourOrg/ai-rules/main/security-guidelines.yaml',
      overwrite: false,          // Do not overwrite existing outputs
      outputs: [
        '.windsurfrules',
        'docs/ai/security-guidelines.yaml',
      ],
    },

    /* 3) Local directory, copied into an output directory, overwrite existing */
    {
      path: './shared-rules/ui-widgets',    // This is a directory
      overwrite: true,
      outputs: ['components/ui-widgets'],   // Copies entire tree under this location
    },

    /* 4) Local PDF, copy only, always overwrite */
    {
      path: './shared-rules/compliance.pdf',
      overwrite: true,
      outputs: ['docs/ai/compliance.pdf'],
    },

    /* 5) Remote JSON, always copy, overwrite if exists */
    {
      url: 'https://example.com/api-spec.json',
      overwrite: true,
      outputs: ['src/assets/api-spec.json'],
    },
  ],
};

export default config;
```

In **JSON** or **YAML**, you’d simply express the same keys:

```jsonc
// .knowhubrc.json
{
  "resources": [
    {
      "path": "./shared-rules/common-style.md",
      "symlink": true,
      "overwrite": true,
      "outputs": [
        ".cursor/rules/common-style.md",
        ".github/copilot-instructions.md"
      ]
    },
    {
      "url": "https://raw.githubusercontent.com/YourOrg/ai-rules/main/security-guidelines.yaml",
      "overwrite": false,
      "outputs": [
        ".windsurfrules",
        "docs/ai/security-guidelines.yaml"
      ]
    },
    {
      "path": "./shared-rules/ui-widgets",
      "overwrite": true,
      "outputs": ["components/ui-widgets"]
    },
    {
      "path": "./shared-rules/compliance.pdf",
      "overwrite": true,
      "outputs": ["docs/ai/compliance.pdf"]
    },
    {
      "url": "https://example.com/api-spec.json",
      "overwrite": true,
      "outputs": ["src/assets/api-spec.json"]
    }
  ]
}
```

Or in **YAML**:

```yaml
# .knowhubrc.yaml
resources:
  - path: './shared-rules/common-style.md'
    symlink: true
    overwrite: true
    outputs:
      - '.cursor/rules/common-style.md'
      - '.github/copilot-instructions.md'

  - url: 'https://raw.githubusercontent.com/YourOrg/ai-rules/main/security-guidelines.yaml'
    overwrite: false
    outputs:
      - '.windsurfrules'
      - 'docs/ai/security-guidelines.yaml'

  - path: './shared-rules/ui-widgets'
    overwrite: true
    outputs:
      - 'components/ui-widgets'

  - path: './shared-rules/compliance.pdf'
    overwrite: true
    outputs:
      - 'docs/ai/compliance.pdf'

  - url: 'https://example.com/api-spec.json'
    overwrite: true
    outputs:
      - 'src/assets/api-spec.json'
```

### 2.3 Resource (Conceptual)

Every resource object in the `resources` array must contain:

1. **Exactly one of**

   * `path` (string): a relative-or-absolute local filesystem path, **OR**
   * `url`  (string): an HTTP(S) URL starting with `http://` or `https://`.

2. **`symlink`** (optional, defaults to `false`):

   * `false` (or omitted) → Duplicate the source (file or text) into each output location.
   * `true` → Create a symbolic link at each output pointing back to the local source. If symlink creation fails (e.g. on Windows without privileges), `knowhub` will automatically fall back to a copy. Note: Only valid with local `path` resources, not `url` resources.

3. **`overwrite`** (optional, defaults to `true`):

   * `true`  → Overwrite any existing file or directory at the output path.
   * `false` → If the output path already exists, skip writing/copying.

4. **`outputs`** (required):

   * Either a single string or an array of strings.
   * Each string is interpreted as a path relative to the project root (or as an absolute path).
   * If the resource’s `path` refers to a **directory**, then each output entry should be a directory path into which the entire source directory tree is copied or symlinked.

---

## 3. Core Process (Conceptual)

When a user runs:

```bash
npx knowhub
```

(or equivalently `yarn knowhub` if installed via yarn, etc.)

1. **Configuration Discovery (via Cosmiconfig)**

   * `knowhub` invokes cosmiconfig under the name `"knowhub"`.
   * Cosmiconfig searches the project root for any of:

     * `.knowhubrc` (JSON or YAML),
     * `.knowhubrc.json`,
     * `.knowhubrc.yaml` / `.yml`,
     * `.knowhubrc.js`,
     * `.knowhubrc.ts`,
     * or the `knowhub` field in `package.json`.
   * The first valid configuration it finds is loaded into memory.

2. **Validation of Resources**

   * The loaded config must be an object with a `resources` array.

   * Each element of `resources` must:

     1. Have exactly one of `path` or `url`.
     2. If `path` is provided, it must point to an existing file or directory on disk.
     3. If `url` is provided, it must start with `http://` or `https://`.
     4. `symlink` (if provided) must be a boolean. Otherwise default to `false`. Cannot be `true` with `url` resources.
     5. `overwrite` (if provided) must be a boolean. Otherwise default to `true`.
     6. `outputs` must be one string or an array of strings (each nonempty).

   * If any validation rule fails, `knowhub` immediately exits with an error message.

3. **Fetch Each Resource**

   * For every validated resource definition:

     * **If `path` is present**:

       * Resolve `path` to an absolute path under the project root.
       * Note whether it refers to a file or a directory.
     * **If `url` is present**:

       * Perform an HTTP GET on the URL.
       * If the response is not 2xx, exit with an error.
       * Read the response body as UTF-8 text.

   * Produce an in-memory array of “fetched resources,” each containing:

     * For a `path` resource: `{ definition, localPath, isDirectory: boolean }`
     * For a `url` resource:  `{ definition, content: string }`

4. **Place Resources into Outputs**

   * For each fetched resource, and for each `outputs` entry:

     1. Determine the absolute output path by resolving the output string under the project root.
     2. If the resource is a **local file** (`localPath` points to a file):

        * If `symlink: true`, attempt `fs.symlinkSync(localPath, output)`.

          * If symlink creation fails (e.g. EPERM on Windows), fall back to copying the file.
        * If `symlink: false` (or omitted), perform a binary copy from `localPath` to `output`.
        * In both cases, if `overwrite: false` and `output` already exists, skip this single output.
        * If `overwrite: true` and `output` already exists, log as "Updated"; if `output` doesn't exist, log as "Created".
     3. If the resource is a **local directory** (`localPath` points to a directory):

        * If `symlink: true`, attempt `fs.symlinkSync(localPath, output, 'junction' )` (on Windows) or `fs.symlinkSync(localPath, output, 'dir')` (on POSIX).

          * If symlink fails for any reason, fall back to recursive directory copy.
        * If `symlink: false` (or omitted), perform a **recursive directory copy**, replicating the entire tree under `localPath` to `output`.

          * In all cases, if `overwrite: false` and `output` (or any file under it) already exists, skip writing/overwriting those existing files; only new files or subdirectories that do not yet exist are created.
          * If `overwrite: true`, existing files or directories under `output` are removed or replaced, ensuring the output ends up as an exact copy of the source directory.
     4. If the resource is a **remote URL** (`content` is a string of text):

        * Always treat it like a single-file copy: open a UTF-8 write stream to `output` and write the `content`.
        * If `overwrite: false` and `output` already exists, skip. Otherwise (if `overwrite: true`), write/overwrite the file.
        * If `overwrite: true` and `output` already exists, log as "Updated"; if `output` doesn't exist, log as "Created".

5. **Finish**

   * Print a summary indicating how many output paths were created or skipped.
   * Exit with a zero exit code if no errors occurred.

---

## 4. Example Folder Layout for the `knowhub` Package

> **Note:** This section is intended for authors of the `knowhub` NPM package. Consumers of `knowhub` do not need to see or modify these files; they only need to install the package and create their own `.knowhubrc.*` in their project.

```
knowhub/
├── bin/
│   └── knowhub.js              # Node shebang entrypoint
├── src/
│   ├── knowhub.ts              # Main entry point
│   ├── cli.ts                  # Argument parsing and command dispatch
│   ├── config.ts               # Configuration loading, validation & type definitions
│   ├── resource-manager.ts     # Fetch local files/directories or HTTP(S) URLs
│   ├── file.ts                 # copyFile, copyDirectory, symlinkOrCopy, writeTextFile
│   ├── errors.ts               # Custom error classes and error handling utilities
│   ├── validators.ts           # Validation utilities for resources and configuration
│   └── commands/
│       ├── index.ts            # Command exports
│       ├── sync.ts             # runSync() function
│       ├── init.ts             # init() function
│       ├── help.ts             # help() function
│       └── version.ts          # version() function
├── templates/
│   └── .knowhubrc.template.ts  # Boilerplate `.knowhubrc.ts` template
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

### 4.1 `bin/knowhub.ts`

```ts
#!/usr/bin/env bun
import '../src/cli';
```

* A simple shebang that invokes `cli.ts`.
* After installing `knowhub`, running `npx knowhub` will execute this file.

### 4.2 `src/cli.ts`

* **Responsibilities:**

  1. Configure [`cosmiconfig`](https://github.com/davidtheclark/cosmiconfig) to search for the “knowhub” config.
  2. Expose an `init` command if the user runs `npx knowhub init`.
  3. Otherwise, run the main “sync” logic when `npx knowhub` is executed without subcommands.
* **Pseudo-flow:**

  1. If `process.argv[2] === 'init'`, call `init()` and exit.
  2. Else, parse any optional flags:

     * `--config <path>` (to override the cosmiconfig search path),
     * `--dry-run` (to simulate without writing).
       Call `runSync({configPath, dryRun})`.

### 4.4 `src/commands/`

* **`commands/index.ts`**: Central export point for all command functions.
* **`commands/sync.ts`**: Contains `runSync()` function (main sync operation).
* **`commands/init.ts`**: Contains `init()` function for configuration template creation.
* **`commands/help.ts`**: Contains `help()` function for displaying usage information.
* **`commands/version.ts`**: Contains `version()` function for displaying version.

### 4.5 `src/errors.ts`

* **Responsibilities:**

  1. Define custom error classes for better error handling and debugging:
     * `KnowhubError`: Base error class
     * `ConfigurationError`: For configuration-related errors
     * `ResourceError`: For resource fetching/processing errors
     * `ValidationError`: For validation failures
     * `FileOperationError`: For file system operation errors
  2. Provide utility functions for consistent error handling:
     * `formatError()`: Convert unknown errors to strings
     * `handleNodeError()`: Handle Node.js errno exceptions with proper error types

### 4.6 `src/validators.ts`

* **Responsibilities:**

  1. Extract validation logic into reusable, testable functions:
     * `validateResourceSource()`: Ensure resource has either path or URL
     * `validateFetchMode()`: Validate and normalize fetch mode
     * `validateOverwrite()`: Validate and normalize overwrite flag
     * `validateOutputs()`: Validate and normalize output paths
     * `validateUrlFormat()`: Validate URL format and protocol
     * `validateConfigStructure()`: Validate configuration object structure
     * `validateResourceStructure()`: Validate resource object structure
     * `validateResource()`: Main resource validation function
     * `validateLocalPath()`: Validate local file/directory paths
  2. Define local constants (like `UrlProtocol`) used within validation functions

### 4.7 `src/config.ts`

* **Responsibilities:**

  1. **Configuration Loading**: Use `cosmiconfig('knowhub')` to locate and load configuration files
  2. **Type Definitions**: Define all core types and interfaces:
     * `FetchMode`: Available fetch modes for resource synchronization
     * `Config`: Main configuration object structure
     * `Resource`: Individual resource definition
     * `FetchedResource`: Resource after fetching/processing
     * `ValidatedResource`: Resource with normalized and validated fields
  3. **Configuration Validation**:
     * Validate configuration structure using validator functions
     * Process each resource with full validation
     * Return fully validated `ValidatedResource` objects
  4. **Error Handling**: Use custom error types for better debugging and error reporting

### 4.8 `src/resource-manager.ts`

* **Responsibilities:**

  1. Accept an array of `ValidatedResource` and the current project root path.
  2. For each resource definition:
     * If `path` is defined: determine whether it is a file or directory; store `localPath` and a boolean flag `isDirectory`.
     * If `url` is defined: perform an HTTP GET; if status is not OK (2xx), throw a `ResourceError`; else read the entire body as a UTF-8 string and store that in `content`.
  3. Use enhanced error handling with custom error types (`ResourceError`, `FileOperationError`) for better debugging.
  4. Return an array of "fetched" resources with proper error context and messaging.

### 4.9 `src/file.ts`

* **Responsibilities:**

  * **Pure Async Operations**: All file operations use async/await patterns without any synchronous calls
  * **Enhanced Error Handling**: Uses custom error types (`FileOperationError`) and local constants for better error reporting
  * **Copying a Single File** (`copyFile`):
    * `copyFile(src: string, dest: string, overwrite: boolean)`
    * Uses async `pathExists()` to check file existence
    * Creates parent directories as needed using `ensureDirectoryExists()`
    * If `overwrite == false` and `dest` exists → skip
    * Otherwise, copy the file from `src` → `dest`
  * **Copying a Directory Recursively** (`copyDirectory`):
    * `copyDirectory(srcDir: string, destDir: string, overwrite: boolean)`
    * Recursively traverses the directory tree with enhanced error handling
    * Returns count of created and skipped files for better reporting
  * **Symlink or Copy** (`symlinkOrCopy`):
    * Uses local platform-specific constants for symlink types (file, dir, junction)
    * Enhanced fallback logic with better error reporting
    * If symlink creation fails, falls back to copying with proper error context
  * **Write Text** (`writeTextFile`):
    * `writeTextFile(dest: string, content: string, overwrite: boolean)`
    * Enhanced directory creation and error handling
  * **Utility Functions**:
    * `ensureDirectoryExists()`: Creates directories with proper error handling
    * `isDirectory()` and `pathExists()`: Async utility functions for path checking
  * **Local Constants**: Defines local constants for SymlinkType, Platform, and ErrorCode within the module
    * Otherwise, write the UTF-8 text to `dest`, overwriting if necessary.

---

## 5. Main “Sync” Operation

```ts
/**
 * runSync:
 *  1. Load & validate config via cosmiconfig.
 *  2. Fetch resources (either local file/dir or URL content).
 *  3. For each fetched resource, for each output:
 *    a. If resource is a file:
 *         - If symlink===true: attempt symlinkOrCopy(localPath, output, overwrite, /*isDir*/ false)
 *         - Else (copy): copyFile(localPath, output, overwrite)
 *    b. If resource is a directory:
 *         - If symlink===true: attempt symlinkOrCopy(localPath, output, overwrite, /*isDir*/ true)
 *         - Else (copy): copyDirectory(localPath, output, overwrite)
 *    c. If resource is URL content:
 *         - writeTextFile(output, content, overwrite)
 *  4. Print summary: how many outputs were created/updated, and how many were skipped due to overwrite=false.
 *  5. Exit with status 0 if successful, or nonzero on error.
 */
```

* **No deletion step**: `knowhub` does not remove any files or directories that were generated in earlier runs.
* **Per-output logic**: each output path is treated independently. A resource’s `overwrite:false` means “if that particular output path already exists, skip writing/copying there.”

---

## 6. Usage & Commands

### 6.1 `init`

```bash
npx knowhub init
```

* Creates a boilerplate config template (e.g. `.knowhubrc.ts`) in the current directory, if no Knowhub config already exists.
* If a config file already exists (in any of the cosmiconfig-supported locations), print an error and exit.

### 6.2 "Sync" (Default)

```bash
npx knowhub [--config <path>] [--dry-run] [--quiet]
```

* **Without subcommands,** `knowhub` performs a single "sync" operation (fetch & place resources).
* **`--config <path>`**: Optional override to tell cosmiconfig exactly which file to load (e.g. `npx knowhub --config ./config/my-knowhub.yaml`).
* **`--dry-run`**: Simulate the entire sync:

  * Print which files/directories would be copied or symlinked, and which outputs would be skipped due to `overwrite:false`.
  * Do not actually write or modify anything on disk.
* **`--quiet`**: Suppress all output. Useful for CI/CD pipelines where you only care about the exit code.

### 6.3 Examples

1. **Initial Setup**

   ```bash
   cd /path/to/your-project
   npm install --save-dev knowhub
   npx knowhub init
   # => Creates a new `.knowhubrc.ts` (or `.js`/`.json`/`.yaml`) in this directory.
   ```

2. **Edit `.knowhubrc.ts`**
   Define your resources (files, directories, URLs, etc.) and outputs.

3. **Run Sync**

   ```bash
   npx knowhub
   ```

   * Fetches, copies, and/or symlinks each resource into its configured outputs.
   * If a resource’s `overwrite:false` and an output path already exists, that output is skipped.
   * No files are deleted in this process.

4. **Verify with Dry Run**

   ```bash
   npx knowhub --dry-run
   ```

   * Prints exactly what would be done without performing any file or network I/O.

5. **Run Quietly (for CI/CD)**

   ```bash
   npx knowhub --quiet
   ```

   * Suppresses all output, useful for automated scripts where you only need the exit code.

6. **Use a Custom Config Path**

   ```bash
   npx knowhub --config ./config/knowhub-settings.yaml
   ```

   * Directs cosmiconfig to load from `./config/knowhub-settings.yaml` instead of searching the default locations.

---

## 7. Examples of Resource Definitions

Below are a few typical resource scenarios you might include in your Knowhub config:

1. **Single Local File → Two Output Locations (Symlink)**

   ```yaml
   # .knowhubrc.yaml
   resources:
     - path: './shared-rules/common-style.md'
       symlink: true
       overwrite: true
       outputs:
         - '.cursor/rules/common-style.md'
         - '.github/copilot-instructions.md'
   ```

   * Creates symlinks from `./shared-rules/common-style.md` → each of the two outputs.
   * If either output file already exists, it is replaced (because `overwrite: true`).
   * On Windows, if symlink creation fails, it will fallback to copying the file instead.

2. **Remote YAML → Two Destinations (Copy, No Overwrite)**

   ```json
   {
     "resources": [
       {
         "url": "https://raw.githubusercontent.com/YourOrg/ai-rules/main/security-guidelines.yaml",
         "overwrite": false,
         "outputs": [
           ".windsurfrules",
           "docs/ai/security-guidelines.yaml"
         ]
       }
     ]
   }
   ```

   * Downloads the YAML content as UTF-8 text.
   * Writes it to each output path **only if that path does not already exist**. Otherwise leaves existing files untouched.

3. **Entire Directory → Single Destination (Copy)**

   ```ts
   // .knowhubrc.ts
   import type { Resource } from 'knowhub';
   const config: { resources: Resource[] } = {
     resources: [
       {
         path: './shared-rules/ui-widgets',
         overwrite: true,
         outputs: ['components/ui-widgets']
       }
     ]
   };
   export default config;
   ```

   * Recursively copies everything under `shared-rules/ui-widgets/*` into `components/ui-widgets/*`.
   * If `components/ui-widgets` already exists, all existing files in that tree are overwritten.

4. **Remote JSON → Single Destination (Copy, Overwrite)**

   ```yaml
   resources:
     - url: 'https://example.com/api-spec.json'
       overwrite: true
       outputs:
         - 'src/assets/api-spec.json'
   ```

   * Fetches the JSON text and writes it to `src/assets/api-spec.json`, overwriting if it already exists.

---

## 8. Key Points & Best Practices

1. **Cosmiconfig for Maximum Flexibility**

   * You can place your Knowhub configuration in any supported file format: `.js`, `.ts`, `.json`, `.yaml`, `.yml`, or inside `package.json` under `"knowhub"`.
   * This makes it easy to adopt YAML-based configs, keep configuration in `package.json`, or use TS for typed guard logic.

2. **No Automatic Deletions**

   * Unlike tools that “clean up” old outputs, `knowhub` never deletes any existing files or directories.
   * If you remove a resource from your config, the previously generated outputs remain on disk.
   * This avoids accidental data loss—`knowhub` only writes or overwrites what you explicitly define.

3. **Directory Copy & Symlink Support**

   * Any resource `path` can point to a directory.
   * `symlink: false` (or omitted) performs a recursive copy of the entire tree.
   * `symlink: true` attempts to symlink the directory as a single unit (with proper flags), falling back to a recursive copy if symlinks cannot be created.

4. **Per-Output Overwrite Control**

   * `overwrite: true` (default) means “always replace existing outputs.”
   * `overwrite: false` means “never replace an existing file/directory; only create it if it’s missing.”
   * Use `overwrite: false` on large files or manually maintained artifacts to avoid stepping on them inadvertently.

5. **One-Command Workflow**

   * No subcommands beyond `init`. Simply `npx knowhub` executes the full sync.
   * Use `--dry-run` to preview all copy/symlink actions without modifying the disk.
   * Use `--config <path>` only if your config resides in a nonstandard location.

6. **CI/CD Integration**

   * In a continuous-integration environment (e.g. GitHub Actions), you might run:

     ```yaml
     - name: Install dependencies
       run: npm ci
     - name: Run knowhub sync
       run: npx knowhub
     - name: Commit output changes
       run: |
         git config user.name "github-actions"
         git config user.email "actions@github.com"
         git add .
         git diff --quiet || git commit -m "chore: update knowhub outputs"
         git push
     ```
   * This ensures that any changes to `.knowhubrc.*` propagate into the generated outputs automatically and are committed back to the repository.

---

## 9. Summary

* Change your project name from **`knowledge-bridge`** to **`knowhub`**, and your CLI command from `npx knowledge-bridge` to `npx knowhub`.
* Do **not** delete outputs when a resource is removed; instead, existing files stay in place.
* Support copying entire directory trees as resources.
* Use [`cosmiconfig("knowhub")`](https://github.com/davidtheclark/cosmiconfig) to discover configuration in any format (TS, JS, JSON, YAML, etc.).
* Each resource has:

  * Exactly one of `path` (file or directory) or `url` (HTTP(S)).
  * A `symlink` boolean (`true` or `false`, defaults to `false`). Can only be `true` with local `path` resources.
  * An `overwrite` flag (`true` or `false`).
  * One or more `outputs` (project-root-relative or absolute paths).

With this design, `knowhub` becomes a lightweight, flexible, zero‐deletion tool for synchronizing any combination of files, directories, or remote resources into designated locations—perfect for sharing coding guidelines, AI‐agent rule files, UI component libraries, or any other project artifacts.

---

## 10. Code Architecture & Refactoring

The `knowhub` codebase has been refactored for enhanced readability, maintainability, and reliability:

### 10.1 **Modular Architecture**

* **Separation of Concerns**: Code is organized into focused modules with clear responsibilities.
* **Reusable Utilities**: Common functionality is extracted into utility modules for better testability.
* **Type Safety**: Enhanced TypeScript usage with centralized type definitions and constants.

### 10.2 **Error Handling Improvements**

* **Custom Error Types**: Specific error classes (`ConfigurationError`, `ResourceError`, `ValidationError`, `FileOperationError`) provide better error context and debugging information.
* **Consistent Error Handling**: Centralized error formatting and Node.js errno exception handling.
* **Better Error Messages**: More descriptive error messages with file paths and operation context.

### 10.3 **Validation Architecture**

* **Modular Validation**: Validation logic is extracted into reusable functions in `validators.ts`.
* **Consistent Validation**: All configuration and resource validation follows the same patterns.
* **Better Error Reporting**: Validation errors include specific field paths and clear descriptions.

### 10.4 **Consolidated Configuration**

* **Unified Config Module**: Configuration loading, type definitions, and validation are consolidated in `config.ts`.
* **Local Constants**: Each module defines its own constants to reduce coupling and improve encapsulation.
* **Type-Safe Constants**: TypeScript const assertions and type unions provide better IDE support.
* **Pure Async Operations**: All file operations use async/await patterns without synchronous calls.

### 10.5 **Module Consolidation**

* **Reduced File Count**: Related functionality is grouped together (config + types, file operations + utilities).
* **Clear Boundaries**: Each module has a focused responsibility with minimal external dependencies.
* **Local Scope**: Constants and utilities are defined within the modules that use them.

### 10.6 **Benefits Achieved**

* ✅ **Maintainability**: Easier to modify and extend functionality with consolidated modules
* ✅ **Readability**: Clear separation of concerns and consistent patterns
* ✅ **Debugging**: Better error messages and error context with custom error types
* ✅ **Testing**: Modular functions are easier to unit test in isolation
* ✅ **Type Safety**: Improved TypeScript usage with proper async patterns
* ✅ **Performance**: Pure async operations without blocking synchronous calls
* ✅ **Simplicity**: Reduced file count with focused, cohesive modules
* ✅ **Consistency**: Uniform error handling and validation throughout the codebase
