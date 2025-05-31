/**
 * Example GitHub Plugin for knowhub
 *
 * This demonstrates how to create a custom plugin that fetches files
 * from GitHub repositories using the Octokit library.
 *
 * To use this plugin:
 * 1. Install dependencies: npm install @octokit/rest
 * 2. Register the plugin in your project
 * 3. Use it in your .knowhubrc.* configuration
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Octokit } from "@octokit/rest";
import {
  PluginConfigurationError,
  PluginError,
} from "../src/plugins/errors.js";
import type {
  Plugin,
  PluginConfigSchema,
  PluginContext,
  PluginResult,
} from "../src/plugins/types.js";

/**
 * Configuration for the GitHub plugin
 */
export default interface GitHubPluginConfig {
  /** Repository owner (user or organization) */
  owner: string;

  /** Repository name */
  repo: string;

  /** File or directory path in the repository */
  path: string;

  /** Branch, tag, or commit SHA (optional, defaults to repository default branch) */
  ref?: string;

  /** GitHub personal access token for private repositories (optional) */
  token?: string;

  /** GitHub Enterprise base URL (optional) */
  baseUrl?: string;
}

/**
 * Example plugin for fetching files and directories from GitHub repositories
 */
export class GitHubPlugin implements Plugin {
  readonly name = "github";
  readonly version = "1.0.0";
  readonly description =
    "Fetch files and directories from GitHub repositories using Octokit";

  readonly schema: PluginConfigSchema = {
    type: "object",
    properties: {
      owner: {
        type: "string",
        description: "Repository owner (user or organization)",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
      path: {
        type: "string",
        description: "File or directory path in the repository",
      },
      ref: {
        type: "string",
        description: "Branch, tag, or commit SHA",
      },
      token: {
        type: "string",
        description: "GitHub personal access token",
      },
      baseUrl: {
        type: "string",
        description: "GitHub Enterprise base URL",
      },
    },
    required: ["owner", "repo", "path"],
    additionalProperties: false,
  };

  async validate(config: unknown): Promise<void> {
    if (!config || typeof config !== "object") {
      throw new PluginConfigurationError(
        this.name,
        "config",
        "must be an object",
      );
    }

    const githubConfig = config as Record<string, unknown>;

    if (
      typeof githubConfig.owner !== "string" ||
      githubConfig.owner.length === 0
    ) {
      throw new PluginConfigurationError(
        this.name,
        "owner",
        "must be a non-empty string",
      );
    }

    if (
      typeof githubConfig.repo !== "string" ||
      githubConfig.repo.length === 0
    ) {
      throw new PluginConfigurationError(
        this.name,
        "repo",
        "must be a non-empty string",
      );
    }

    if (
      typeof githubConfig.path !== "string" ||
      githubConfig.path.length === 0
    ) {
      throw new PluginConfigurationError(
        this.name,
        "path",
        "must be a non-empty string",
      );
    }

    if (
      githubConfig.ref !== undefined &&
      (typeof githubConfig.ref !== "string" || githubConfig.ref.length === 0)
    ) {
      throw new PluginConfigurationError(
        this.name,
        "ref",
        "must be a non-empty string",
      );
    }

    if (
      githubConfig.token !== undefined &&
      (typeof githubConfig.token !== "string" ||
        githubConfig.token.length === 0)
    ) {
      throw new PluginConfigurationError(
        this.name,
        "token",
        "must be a non-empty string",
      );
    }

    if (
      githubConfig.baseUrl !== undefined &&
      (typeof githubConfig.baseUrl !== "string" ||
        githubConfig.baseUrl.length === 0)
    ) {
      throw new PluginConfigurationError(
        this.name,
        "baseUrl",
        "must be a non-empty string",
      );
    }
  }

  async fetch(config: unknown, context: PluginContext): Promise<PluginResult> {
    await this.validate(config);

    const githubConfig = config as GitHubPluginConfig;

    const token = githubConfig.token
      ? this.resolveEnvVars(githubConfig.token)
      : undefined;

    const octokit = new Octokit({
      auth: token,
      baseUrl: githubConfig.baseUrl,
    });

    const { owner, repo, path, ref } = githubConfig;

    context.logger.info(
      `GitHub plugin: Fetching ${owner}/${repo}:${path}${ref ? ` (ref: ${ref})` : ""}`,
    );

    try {
      const contentResponse = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(contentResponse.data)) {
        return await this.fetchDirectory(octokit, githubConfig, context);
      }

      if (contentResponse.data.type === "file") {
        return await this.fetchFile(octokit, githubConfig, context);
      }

      throw new PluginError(
        `Unsupported content type: ${contentResponse.data.type}`,
        this.name,
      );
    } catch (error) {
      if (error instanceof PluginError) {
        throw error;
      }

      let errorMessage = "Unknown error";
      if (error && typeof error === "object" && "status" in error) {
        const githubError = error as { status: number; message?: string };
        const status = githubError.status;
        if (status === 404) {
          errorMessage = `Repository, path, or ref not found: ${owner}/${repo}:${path}${ref ? ` (ref: ${ref})` : ""}`;
        } else if (status === 401) {
          errorMessage = "Authentication failed. Check your GitHub token.";
        } else if (status === 403) {
          errorMessage =
            "Access forbidden. Check repository permissions and token scopes.";
        } else {
          errorMessage = `GitHub API error (${status}): ${githubError.message || "Unknown error"}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      throw new PluginError(
        `Failed to fetch from GitHub: ${errorMessage}`,
        this.name,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async fetchFile(
    octokit: Octokit,
    config: GitHubPluginConfig,
    context: PluginContext,
  ): Promise<PluginResult> {
    const { owner, repo, path, ref } = config;

    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(response.data) || response.data.type !== "file") {
      throw new PluginError(
        `Expected file but got ${Array.isArray(response.data) ? "directory" : response.data.type}`,
        this.name,
      );
    }

    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8",
    );

    context.logger.info(
      `GitHub plugin: Successfully fetched file ${path} (${content.length} bytes)`,
    );

    return {
      content,
      isDirectory: false,
      metadata: {
        lastModified: response.data.size ? undefined : new Date(),
        version: response.data.sha,
        etag: response.data.sha,
        size: response.data.size,
        githubSha: response.data.sha,
        githubUrl: response.data.html_url,
      },
    };
  }

  private async fetchDirectory(
    octokit: Octokit,
    config: GitHubPluginConfig,
    context: PluginContext,
  ): Promise<PluginResult> {
    const { owner, repo, path, ref } = config;

    const tempDir = join(
      context.projectRoot,
      ".knowhub-temp",
      `github-${owner}-${repo}-${Date.now()}`,
    );
    await mkdir(tempDir, { recursive: true });

    const files = await this.fetchDirectoryRecursive(
      octokit,
      config,
      path,
      tempDir,
      context,
    );

    context.logger.info(
      `GitHub plugin: Successfully fetched directory ${path} (${files.length} files)`,
    );

    return {
      localPath: tempDir,
      isDirectory: true,
      metadata: {
        version: ref || "HEAD",
        githubRepo: `${owner}/${repo}`,
        githubPath: path,
        filesCount: files.length,
      },
    };
  }

  private async fetchDirectoryRecursive(
    octokit: Octokit,
    config: GitHubPluginConfig,
    dirPath: string,
    localDir: string,
    context: PluginContext,
  ): Promise<string[]> {
    const { owner, repo, ref } = config;
    const files: string[] = [];

    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: dirPath,
      ref,
    });

    if (!Array.isArray(response.data)) {
      throw new PluginError(
        `Expected directory but got ${response.data.type}`,
        this.name,
      );
    }

    for (const item of response.data) {
      const itemLocalPath = join(localDir, item.name);

      if (item.type === "file") {
        const fileResponse = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: item.path,
          ref,
        });

        if (
          Array.isArray(fileResponse.data) ||
          fileResponse.data.type !== "file"
        ) {
          continue;
        }

        await mkdir(dirname(itemLocalPath), { recursive: true });

        const content = Buffer.from(
          fileResponse.data.content,
          "base64",
        ).toString("utf-8");
        await writeFile(itemLocalPath, content, "utf-8");
        files.push(itemLocalPath);

        context.logger.info(`GitHub plugin: Fetched file ${item.path}`);
      } else if (item.type === "dir") {
        await mkdir(itemLocalPath, { recursive: true });
        const subFiles = await this.fetchDirectoryRecursive(
          octokit,
          config,
          item.path,
          itemLocalPath,
          context,
        );
        files.push(...subFiles);
      }
    }

    return files;
  }

  private resolveEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const envValue = process.env[envVar];
      if (!envValue) {
        throw new PluginConfigurationError(
          this.name,
          "token",
          `Environment variable ${envVar} is not set`,
        );
      }
      return envValue;
    });
  }
}
