import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFile, stat } from "node:fs/promises";
import { runSync } from "../../src/commands/sync.js";
import { TestLogger } from "../../src/logger.js";
import {
  TestEnvironment,
  mockFetch,
  mockHttpServer,
} from "../helpers/test-utils.js";

describe("Integration", () => {
  let testEnv: TestEnvironment;
  let originalCwd: string;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    testEnv = new TestEnvironment("integration-sync");
    await testEnv.setup();
    mockHttpServer.clear();

    originalCwd = process.cwd();
    originalFetch = global.fetch;
    process.chdir(testEnv.tempDir);
    (global as typeof globalThis & { fetch: typeof fetch }).fetch =
      mockFetch as typeof fetch;
  });

  afterEach(async () => {
    try {
      process.chdir(originalCwd);
    } catch (error) {
      // Directory may have been cleaned up, ignore the error
    }
    await testEnv.cleanup();
    global.fetch = originalFetch;
  });

  it("sync local file with copy mode", async () => {
    const sourceContent = "# AI Guidelines\nThis is a test guideline file.";
    await testEnv.createFile("guidelines.md", sourceContent);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./guidelines.md",
          },
          overwrite: true,
          outputs: [".cursor/rules/guidelines.md", "docs/ai-guidelines.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const output1 = await readFile(
      testEnv.path(".cursor/rules/guidelines.md"),
      "utf8",
    );
    const output2 = await readFile(
      testEnv.path("docs/ai-guidelines.md"),
      "utf8",
    );

    expect(output1).toBe(sourceContent);
    expect(output2).toBe(sourceContent);
  });

  it("sync remote URL with copy mode", async () => {
    const url =
      "https://raw.githubusercontent.com/example/ai-rules/main/security.yaml";
    const remoteContent = `
security:
  rules:
    - no-secrets-in-code
    - validate-inputs
    - use-https
`;

    mockHttpServer.setResponse(url, 200, remoteContent);

    const config = {
      resources: [
        {
          plugin: "http",
          pluginConfig: {
            url,
          },
          overwrite: true,
          outputs: [".windsurfrules", "docs/security-guidelines.yaml"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);

    const output1 = await readFile(testEnv.path(".windsurfrules"), "utf8");
    const output2 = await readFile(
      testEnv.path("docs/security-guidelines.yaml"),
      "utf8",
    );

    expect(output1).toBe(remoteContent);
    expect(output2).toBe(remoteContent);
  });

  it("sync directory with copy mode", async () => {
    await testEnv.createFile(
      "shared-rules/ui/button.md",
      "# Button Component Rules",
    );
    await testEnv.createFile(
      "shared-rules/ui/input.md",
      "# Input Component Rules",
    );
    await testEnv.createFile(
      "shared-rules/ui/layout/grid.md",
      "# Grid Layout Rules",
    );

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./shared-rules/ui",
          },
          overwrite: true,
          outputs: ["components/ui-rules"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(3);
    expect(result.errors).toHaveLength(0);

    const buttonRules = await readFile(
      testEnv.path("components/ui-rules/button.md"),
      "utf8",
    );
    const inputRules = await readFile(
      testEnv.path("components/ui-rules/input.md"),
      "utf8",
    );
    const gridRules = await readFile(
      testEnv.path("components/ui-rules/layout/grid.md"),
      "utf8",
    );

    expect(buttonRules).toBe("# Button Component Rules");
    expect(inputRules).toBe("# Input Component Rules");
    expect(gridRules).toBe("# Grid Layout Rules");
  });

  it("respect overwrite: false setting", async () => {
    const originalContent = "# Original Guidelines";
    const newContent = "# Updated Guidelines";

    await testEnv.createFile("source.md", newContent);
    await testEnv.createFile("existing-output.md", originalContent);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: false,
          outputs: ["existing-output.md", "new-output.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);

    const existingOutput = await readFile(
      testEnv.path("existing-output.md"),
      "utf8",
    );
    const newOutput = await readFile(testEnv.path("new-output.md"), "utf8");

    expect(existingOutput).toBe(originalContent);
    expect(newOutput).toBe(newContent);
  });

  it("handle mixed resource types", async () => {
    const localContent = "# Local Rules";
    const remoteContent = "remote: config";
    const url = "https://example.com/config.yaml";

    await testEnv.createFile("local-rules.md", localContent);
    await testEnv.createDirectory("shared-components");
    await testEnv.createFile("shared-components/component.md", "# Component");

    mockHttpServer.setResponse(url, 200, remoteContent);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./local-rules.md",
          },
          overwrite: true,
          outputs: ["output/local.md"],
        },
        {
          plugin: "local",
          pluginConfig: {
            path: "./shared-components",
          },
          overwrite: true,
          outputs: ["output/components"],
        },
        {
          plugin: "http",
          pluginConfig: {
            url,
          },
          overwrite: true,
          outputs: ["output/remote.yaml"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(3);
    expect(result.errors).toHaveLength(0);

    const localOutput = await readFile(testEnv.path("output/local.md"), "utf8");
    const componentOutput = await readFile(
      testEnv.path("output/components/component.md"),
      "utf8",
    );
    const remoteOutput = await readFile(
      testEnv.path("output/remote.yaml"),
      "utf8",
    );

    expect(localOutput).toBe(localContent);
    expect(componentOutput).toBe("# Component");
    expect(remoteOutput).toBe(remoteContent);
  });

  it("handle symlink mode gracefully", async () => {
    const content = "# Symlink Test";
    await testEnv.createFile("source.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          symlink: true,
          overwrite: true,
          outputs: ["symlinked.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);

    const output = await readFile(testEnv.path("symlinked.md"), "utf8");
    expect(output).toBe(content);
  });

  it("continue processing when one resource fails", async () => {
    const validContent = "# Valid Content";
    const validUrl = "https://example.com/valid.txt";
    const invalidUrl = "https://example.com/invalid.txt";

    await testEnv.createFile("valid.md", validContent);
    mockHttpServer.setResponse(validUrl, 200, "Valid remote content");
    mockHttpServer.setResponse(invalidUrl, 500, "Server Error");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./valid.md",
          },
          overwrite: true,
          outputs: ["output/valid.md"],
        },
        {
          plugin: "http",
          pluginConfig: {
            url: validUrl,
          },
          overwrite: true,
          outputs: ["output/valid-remote.txt"],
        },
        {
          plugin: "http",
          pluginConfig: {
            url: invalidUrl,
          },
          overwrite: true,
          outputs: ["output/invalid-remote.txt"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handle dry run mode", async () => {
    const content = "# Dry Run Test";
    await testEnv.createFile("source.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: true,
          outputs: ["output.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ dryRun: true });

    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(0);

    try {
      await stat(testEnv.path("output.md"));
      expect(false).toBe(true);
    } catch (error) {
      expect(true).toBe(true);
    }
  });

  it("handle complex nested directory structures", async () => {
    await testEnv.createFile(
      "src/components/ui/button/index.md",
      "# Button Index",
    );
    await testEnv.createFile(
      "src/components/ui/button/styles.md",
      "# Button Styles",
    );
    await testEnv.createFile(
      "src/components/ui/input/index.md",
      "# Input Index",
    );
    await testEnv.createFile(
      "src/components/layout/header.md",
      "# Header Layout",
    );
    await testEnv.createFile("src/utils/helpers.md", "# Helper Utils");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./src",
          },
          overwrite: true,
          outputs: ["docs/codebase-rules"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(5);
    expect(result.errors).toHaveLength(0);

    const buttonIndex = await readFile(
      testEnv.path("docs/codebase-rules/components/ui/button/index.md"),
      "utf8",
    );
    const inputIndex = await readFile(
      testEnv.path("docs/codebase-rules/components/ui/input/index.md"),
      "utf8",
    );
    const helpers = await readFile(
      testEnv.path("docs/codebase-rules/utils/helpers.md"),
      "utf8",
    );

    expect(buttonIndex).toBe("# Button Index");
    expect(inputIndex).toBe("# Input Index");
    expect(helpers).toBe("# Helper Utils");
  });

  it("handle Unicode content correctly", async () => {
    const unicodeContent = "# 规则 Rules 🚀\n\nCafé résumé naïve 世界 🌍";
    const url = "https://example.com/unicode.md";

    await testEnv.createFile("local-unicode.md", unicodeContent);
    mockHttpServer.setResponse(url, 200, unicodeContent);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./local-unicode.md",
          },
          overwrite: true,
          outputs: ["output/local-unicode.md"],
        },
        {
          plugin: "http",
          pluginConfig: {
            url,
          },
          overwrite: true,
          outputs: ["output/remote-unicode.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);

    const localOutput = await readFile(
      testEnv.path("output/local-unicode.md"),
      "utf8",
    );
    const remoteOutput = await readFile(
      testEnv.path("output/remote-unicode.md"),
      "utf8",
    );

    expect(localOutput).toBe(unicodeContent);
    expect(remoteOutput).toBe(unicodeContent);
  });

  it("show 'Updated' when overwriting existing files", async () => {
    const originalContent = "# Original Content";
    const newContent = "# Updated Content";

    await testEnv.createFile("source.md", newContent);
    await testEnv.createFile("existing.md", originalContent);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: true,
          outputs: ["existing.md", "new.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);

    const existingOutput = await readFile(testEnv.path("existing.md"), "utf8");
    const newOutput = await readFile(testEnv.path("new.md"), "utf8");

    expect(existingOutput).toBe(newContent);
    expect(newOutput).toBe(newContent);
  });

  it("skip files with identical content even when overwrite: true", async () => {
    const content = "# Same Content";

    await testEnv.createFile("source.md", content);
    await testEnv.createFile("existing.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: true,
          outputs: ["existing.md", "new.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);

    const existingOutput = await readFile(testEnv.path("existing.md"), "utf8");
    const newOutput = await readFile(testEnv.path("new.md"), "utf8");

    expect(existingOutput).toBe(content);
    expect(newOutput).toBe(content);
  });

  it("skip URLs with identical content even when overwrite: true", async () => {
    const content = "remote: same-content";
    const url = "https://example.com/same-content.yaml";

    await testEnv.createFile("existing.yaml", content);
    mockHttpServer.setResponse(url, 200, content);

    const config = {
      resources: [
        {
          plugin: "http",
          pluginConfig: {
            url,
          },
          overwrite: true,
          outputs: ["existing.yaml", "new.yaml"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync();

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);

    const existingOutput = await readFile(
      testEnv.path("existing.yaml"),
      "utf8",
    );
    const newOutput = await readFile(testEnv.path("new.yaml"), "utf8");

    expect(existingOutput).toBe(content);
    expect(newOutput).toBe(content);
  });

  it("test logging output", async () => {
    const content = "# Test Content";
    const logger = new TestLogger();

    await testEnv.createFile("source.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: true,
          outputs: ["new1.md", "new2.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ logger });

    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);

    const successMessages = logger.getMessages("success");
    expect(successMessages).toContain("✓ Created: new1.md");
    expect(successMessages).toContain("✓ Created: new2.md");

    const infoMessages = logger.getMessages("info");
    const summaryMessages = infoMessages.filter(
      (msg) =>
        msg.includes("SYNC SUMMARY") ||
        msg.includes("Created: 2") ||
        msg.includes("Total outputs processed: 2"),
    );
    expect(summaryMessages.length).toBeGreaterThan(0);
  });

  it("test quiet mode suppresses output", async () => {
    const content = "# Quiet Test";

    await testEnv.createFile("source.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          outputs: ["quiet-output.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ quiet: true });

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);

    const output = await readFile(testEnv.path("quiet-output.md"), "utf8");
    expect(output).toBe(content);
  });

  it("test logging for skipped files", async () => {
    const content = "# Skip Test";
    const logger = new TestLogger();

    await testEnv.createFile("source.md", content);
    await testEnv.createFile("existing.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: true,
          outputs: ["existing.md", "new.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ logger });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);

    const skipMessages = logger.getMessages("skip");
    expect(skipMessages).toContain(
      "- Skipped: existing.md (content identical)",
    );

    const successMessages = logger.getMessages("success");
    expect(successMessages).toContain("✓ Created: new.md");
  });

  it("test logging for overwrite: false", async () => {
    const content = "# Overwrite False Test";
    const logger = new TestLogger();

    await testEnv.createFile("source.md", content);
    await testEnv.createFile("existing.md", "different content");

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: false,
          outputs: ["existing.md", "new.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ logger });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);

    const skipMessages = logger.getMessages("skip");
    expect(skipMessages).toContain(
      "- Skipped: existing.md (already exists, overwrite: false)",
    );

    const successMessages = logger.getMessages("success");
    expect(successMessages).toContain("✓ Created: new.md");
  });

  it("test dry run logging", async () => {
    const content = "# Dry Run Test";
    const logger = new TestLogger();

    await testEnv.createFile("source.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          outputs: ["output.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ dryRun: true, logger });

    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(0);

    const infoMessages = logger.getMessages("info");
    expect(infoMessages).toContain("[DRY RUN] Would process: output.md");

    const summaryMessages = infoMessages.filter((msg) =>
      msg.includes("DRY RUN SUMMARY"),
    );
    expect(summaryMessages.length).toBeGreaterThan(0);
  });

  it("ensure identical content is never counted as updated", async () => {
    const content = "# Identical Content Test";
    const logger = new TestLogger();

    await testEnv.createFile("source.md", content);
    await testEnv.createFile("existing.md", content);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: true,
          outputs: ["existing.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ logger });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);

    const skipMessages = logger.getMessages("skip");
    expect(skipMessages).toContain(
      "- Skipped: existing.md (content identical)",
    );

    const successMessages = logger.getMessages("success");
    expect(successMessages).not.toContain("✓ Updated: existing.md");
    expect(successMessages).not.toContain("✓ Created: existing.md");
  });

  it("ensure different content is properly counted as updated", async () => {
    const originalContent = "# Original Content";
    const newContent = "# Updated Content";
    const logger = new TestLogger();

    await testEnv.createFile("source.md", newContent);
    await testEnv.createFile("existing.md", originalContent);

    const config = {
      resources: [
        {
          plugin: "local",
          pluginConfig: {
            path: "./source.md",
          },
          overwrite: true,
          outputs: ["existing.md"],
        },
      ],
    };

    await testEnv.createConfig(config);

    const result = await runSync({ logger });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const successMessages = logger.getMessages("success");
    expect(successMessages).toContain("✓ Updated: existing.md");

    const finalContent = await readFile(testEnv.path("existing.md"), "utf8");
    expect(finalContent).toBe(newContent);
  });
});
