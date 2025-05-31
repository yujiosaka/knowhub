import { ResourceError } from "../../errors.js";
import { PluginConfigurationError, PluginError } from "../errors.js";
import type {
  Plugin,
  PluginConfigSchema,
  PluginContext,
  PluginResult,
} from "../types.js";

/**
 * Configuration for the HTTP plugin
 */
export interface HttpPluginConfig {
  /** HTTP(S) URL to fetch */
  url: string;

  /** Optional custom headers */
  headers?: Record<string, string>;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** HTTP method (default: GET) */
  method?: string;

  /** Request body for POST/PUT requests */
  body?: string;
}

/**
 * Plugin for handling HTTP(S) resources
 * This maintains backward compatibility with existing `url` resources
 */
export class HttpPlugin implements Plugin {
  readonly name = "http";
  readonly version = "1.0.0";
  readonly description = "Fetch files from HTTP(S) URLs with advanced features";

  readonly schema: PluginConfigSchema = {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "HTTP(S) URL to fetch",
      },
      headers: {
        type: "object",
        description: "Custom HTTP headers",
        additionalProperties: { type: "string" },
      },
      timeout: {
        type: "number",
        description: "Request timeout in milliseconds",
        minimum: 1000,
        maximum: 300000,
      },
      method: {
        type: "string",
        description: "HTTP method",
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
      },
      body: {
        type: "string",
        description: "Request body for POST/PUT requests",
      },
    },
    required: ["url"],
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

    const httpConfig = config as Record<string, unknown>;

    if (typeof httpConfig.url !== "string" || httpConfig.url.length === 0) {
      throw new PluginConfigurationError(
        this.name,
        "url",
        "must be a non-empty string",
      );
    }

    try {
      const url = new URL(httpConfig.url);
      if (!url.protocol.startsWith("http")) {
        throw new PluginConfigurationError(
          this.name,
          "url",
          "must be an HTTP(S) URL",
        );
      }
    } catch (error) {
      throw new PluginConfigurationError(
        this.name,
        "url",
        "must be a valid URL",
      );
    }

    if (httpConfig.headers !== undefined) {
      if (
        typeof httpConfig.headers !== "object" ||
        httpConfig.headers === null ||
        Array.isArray(httpConfig.headers)
      ) {
        throw new PluginConfigurationError(
          this.name,
          "headers",
          "must be an object",
        );
      }

      const headers = httpConfig.headers as Record<string, unknown>;
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value !== "string") {
          throw new PluginConfigurationError(
            this.name,
            `headers.${key}`,
            "must be a string",
          );
        }
      }
    }

    if (httpConfig.timeout !== undefined) {
      if (
        typeof httpConfig.timeout !== "number" ||
        httpConfig.timeout < 1000 ||
        httpConfig.timeout > 300000
      ) {
        throw new PluginConfigurationError(
          this.name,
          "timeout",
          "must be a number between 1000 and 300000",
        );
      }
    }

    if (httpConfig.method !== undefined) {
      const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
      if (
        typeof httpConfig.method !== "string" ||
        !validMethods.includes(httpConfig.method.toUpperCase())
      ) {
        throw new PluginConfigurationError(
          this.name,
          "method",
          `must be one of: ${validMethods.join(", ")}`,
        );
      }
    }

    if (httpConfig.body !== undefined && typeof httpConfig.body !== "string") {
      throw new PluginConfigurationError(this.name, "body", "must be a string");
    }
  }

  async fetch(config: unknown, context: PluginContext): Promise<PluginResult> {
    await this.validate(config);

    const httpConfig = config as HttpPluginConfig;
    const url = httpConfig.url;
    const timeout = httpConfig.timeout || 30000;
    const method = (httpConfig.method || "GET").toUpperCase();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const requestOptions: RequestInit = {
        method,
        headers: {
          "User-Agent": "knowhub/1.0.0",
          ...httpConfig.headers,
        },
        signal: controller.signal,
      };

      if (httpConfig.body && ["POST", "PUT", "PATCH"].includes(method)) {
        requestOptions.body = httpConfig.body;
      }

      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ResourceError(
          `HTTP ${response.status} ${response.statusText}: Failed to fetch ${url}`,
          url,
        );
      }

      const content = await response.text();
      const lastModified = response.headers.get("last-modified");
      const etag = response.headers.get("etag");
      const contentType = response.headers.get("content-type");

      return {
        content,
        isDirectory: false,
        metadata: {
          lastModified: lastModified ? new Date(lastModified) : undefined,
          etag: etag || undefined,
          version: etag || response.headers.get("x-version") || undefined,
          contentType: contentType || undefined,
          responseHeaders: Object.fromEntries(response.headers.entries()),
        },
      };
    } catch (error) {
      if (error instanceof ResourceError) {
        throw new PluginError(error.message, this.name, error);
      }

      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = `Request timeout after ${timeout}ms`;
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = String(error);
      }

      throw new PluginError(
        `Failed to fetch URL "${url}": ${errorMessage}`,
        this.name,
        error instanceof Error ? error : undefined,
      );
    }
  }
}
