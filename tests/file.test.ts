import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  copyDirectory,
  copyFile,
  isDirectory,
  pathExists,
  symlinkOrCopy,
  writeTextFile,
} from "../src/file.js";
import { TestEnvironment } from "./helpers/test-utils.js";

describe("copyFile", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("copy-file");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("copy file to new location", async () => {
    const content = "test file content";
    await testEnv.createFile("source.txt", content);

    const srcPath = testEnv.path("source.txt");
    const destPath = testEnv.path("dest.txt");

    const result = await copyFile(srcPath, destPath, true);
    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);

    const copiedContent = await readFile(destPath, "utf8");
    expect(copiedContent).toBe(content);
  });

  it("create parent directories when copying", async () => {
    const content = "test content";
    await testEnv.createFile("source.txt", content);

    const srcPath = testEnv.path("source.txt");
    const destPath = testEnv.path("nested/dir/dest.txt");

    const result = await copyFile(srcPath, destPath, true);
    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);

    const copiedContent = await readFile(destPath, "utf8");
    expect(copiedContent).toBe(content);
  });

  it("overwrite existing file when overwrite is true", async () => {
    const originalContent = "original content";
    const newContent = "new content";

    await testEnv.createFile("source.txt", newContent);
    await testEnv.createFile("dest.txt", originalContent);

    const srcPath = testEnv.path("source.txt");
    const destPath = testEnv.path("dest.txt");

    const result = await copyFile(srcPath, destPath, true);
    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);

    const finalContent = await readFile(destPath, "utf8");
    expect(finalContent).toBe(newContent);
  });

  it("skip copying when overwrite is false and file exists", async () => {
    const originalContent = "original content";
    const newContent = "new content";

    await testEnv.createFile("source.txt", newContent);
    await testEnv.createFile("dest.txt", originalContent);

    const srcPath = testEnv.path("source.txt");
    const destPath = testEnv.path("dest.txt");

    const result = await copyFile(srcPath, destPath, false);
    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);

    const finalContent = await readFile(destPath, "utf8");
    expect(finalContent).toBe(originalContent);
  });
});

describe("copyDirectory", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("copy-directory");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("copy directory with files", async () => {
    await testEnv.createFile("src/file1.txt", "content1");
    await testEnv.createFile("src/file2.txt", "content2");

    const srcDir = testEnv.path("src");
    const destDir = testEnv.path("dest");

    const result = await copyDirectory(srcDir, destDir, true);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);

    const file1Content = await readFile(testEnv.path("dest/file1.txt"), "utf8");
    const file2Content = await readFile(testEnv.path("dest/file2.txt"), "utf8");
    expect(file1Content).toBe("content1");
    expect(file2Content).toBe("content2");
  });

  it("copy nested directory structure", async () => {
    await testEnv.createFile("src/level1/level2/deep.txt", "deep content");
    await testEnv.createFile("src/level1/shallow.txt", "shallow content");
    await testEnv.createFile("src/root.txt", "root content");

    const srcDir = testEnv.path("src");
    const destDir = testEnv.path("dest");

    const result = await copyDirectory(srcDir, destDir, true);
    expect(result.created).toBe(3);

    const deepContent = await readFile(
      testEnv.path("dest/level1/level2/deep.txt"),
      "utf8",
    );
    const shallowContent = await readFile(
      testEnv.path("dest/level1/shallow.txt"),
      "utf8",
    );
    const rootContent = await readFile(testEnv.path("dest/root.txt"), "utf8");

    expect(deepContent).toBe("deep content");
    expect(shallowContent).toBe("shallow content");
    expect(rootContent).toBe("root content");
  });

  it("skip existing files when overwrite is false", async () => {
    await testEnv.createFile("src/file1.txt", "new content1");
    await testEnv.createFile("src/file2.txt", "new content2");
    await testEnv.createFile("dest/file1.txt", "existing content1");

    const srcDir = testEnv.path("src");
    const destDir = testEnv.path("dest");

    const result = await copyDirectory(srcDir, destDir, false);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);

    const file1Content = await readFile(testEnv.path("dest/file1.txt"), "utf8");
    const file2Content = await readFile(testEnv.path("dest/file2.txt"), "utf8");
    expect(file1Content).toBe("existing content1");
    expect(file2Content).toBe("new content2");
  });

  it("handle empty directory", async () => {
    await testEnv.createDirectory("src");

    const srcDir = testEnv.path("src");
    const destDir = testEnv.path("dest");

    const result = await copyDirectory(srcDir, destDir, true);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);

    const destExists = await pathExists(destDir);
    expect(destExists).toBe(true);

    const destIsDir = await isDirectory(destDir);
    expect(destIsDir).toBe(true);
  });
});

describe("symlinkOrCopy", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("symlink-or-copy");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("create symlink for file", async () => {
    const content = "symlink test content";
    await testEnv.createFile("source.txt", content);

    const srcPath = testEnv.path("source.txt");
    const destPath = testEnv.path("link.txt");

    const result = await symlinkOrCopy(srcPath, destPath, true, false);
    expect(result.created).toBe(true);

    const linkedContent = await readFile(destPath, "utf8");
    expect(linkedContent).toBe(content);
  });

  it("create symlink for directory", async () => {
    await testEnv.createFile("src/test.txt", "test content");

    const srcDir = testEnv.path("src");
    const destDir = testEnv.path("link-dir");

    const result = await symlinkOrCopy(srcDir, destDir, true, true);
    expect(result.created).toBe(true);

    const testContent = await readFile(
      testEnv.path("link-dir/test.txt"),
      "utf8",
    );
    expect(testContent).toBe("test content");
  });

  it("skip when overwrite is false and destination exists", async () => {
    await testEnv.createFile("source.txt", "source content");
    await testEnv.createFile("existing.txt", "existing content");

    const srcPath = testEnv.path("source.txt");
    const destPath = testEnv.path("existing.txt");

    const result = await symlinkOrCopy(srcPath, destPath, false, false);
    expect(result.created).toBe(false);
    expect(result.usedSymlink).toBe(false);

    const existingContent = await readFile(destPath, "utf8");
    expect(existingContent).toBe("existing content");
  });

  it("create parent directories", async () => {
    await testEnv.createFile("source.txt", "test content");

    const srcPath = testEnv.path("source.txt");
    const destPath = testEnv.path("nested/dir/link.txt");

    const result = await symlinkOrCopy(srcPath, destPath, true, false);
    expect(result.created).toBe(true);

    const linkedContent = await readFile(destPath, "utf8");
    expect(linkedContent).toBe("test content");
  });
});

describe("writeTextFile", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("write-text-file");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("write text to new file", async () => {
    const content = "Hello, world!";
    const filePath = testEnv.path("test.txt");

    const result = await writeTextFile(filePath, content, true);
    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);

    const writtenContent = await readFile(filePath, "utf8");
    expect(writtenContent).toBe(content);
  });

  it("create parent directories", async () => {
    const content = "nested file content";
    const filePath = testEnv.path("nested/dir/test.txt");

    const result = await writeTextFile(filePath, content, true);
    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);

    const writtenContent = await readFile(filePath, "utf8");
    expect(writtenContent).toBe(content);
  });

  it("overwrite existing file when overwrite is true and content differs", async () => {
    const originalContent = "original";
    const newContent = "new content";

    await testEnv.createFile("test.txt", originalContent);
    const filePath = testEnv.path("test.txt");

    const result = await writeTextFile(filePath, newContent, true);
    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);

    const finalContent = await readFile(filePath, "utf8");
    expect(finalContent).toBe(newContent);
  });

  it("skip writing when content is identical even with overwrite: true", async () => {
    const content = "identical text content";

    await testEnv.createFile("test.txt", content);
    const filePath = testEnv.path("test.txt");

    const result = await writeTextFile(filePath, content, true);
    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);

    const finalContent = await readFile(filePath, "utf8");
    expect(finalContent).toBe(content);
  });

  it("skip writing when overwrite is false and file exists", async () => {
    const originalContent = "original";
    const newContent = "new content";

    await testEnv.createFile("test.txt", originalContent);
    const filePath = testEnv.path("test.txt");

    const result = await writeTextFile(filePath, newContent, false);
    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);

    const finalContent = await readFile(filePath, "utf8");
    expect(finalContent).toBe(originalContent);
  });

  it("handle UTF-8 content", async () => {
    const content = "Hello 世界! 🌍";
    const filePath = testEnv.path("utf8.txt");

    const result = await writeTextFile(filePath, content, true);
    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);

    const writtenContent = await readFile(filePath, "utf8");
    expect(writtenContent).toBe(content);
  });
});

describe("isDirectory", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("is-directory");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("return true for directory", async () => {
    await testEnv.createDirectory("test-dir");
    const dirPath = testEnv.path("test-dir");

    const result = await isDirectory(dirPath);
    expect(result).toBe(true);
  });

  it("return false for file", async () => {
    await testEnv.createFile("test.txt", "content");
    const filePath = testEnv.path("test.txt");

    const result = await isDirectory(filePath);
    expect(result).toBe(false);
  });

  it("return false for non-existent path", async () => {
    const nonExistentPath = testEnv.path("does-not-exist");

    const result = await isDirectory(nonExistentPath);
    expect(result).toBe(false);
  });
});

describe("pathExists", () => {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    testEnv = new TestEnvironment("path-exists");
    await testEnv.setup();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it("return true for existing file", async () => {
    await testEnv.createFile("test.txt", "content");
    const filePath = testEnv.path("test.txt");

    const result = await pathExists(filePath);
    expect(result).toBe(true);
  });

  it("return true for existing directory", async () => {
    await testEnv.createDirectory("test-dir");
    const dirPath = testEnv.path("test-dir");

    const result = await pathExists(dirPath);
    expect(result).toBe(true);
  });

  it("return false for non-existent path", async () => {
    const nonExistentPath = testEnv.path("does-not-exist");

    const result = await pathExists(nonExistentPath);
    expect(result).toBe(false);
  });

  it("return true for temp directory itself", async () => {
    const result = await pathExists(testEnv.tempDir);
    expect(result).toBe(true);
  });
});
