import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class TestEnvironment {
  public readonly tempDir: string;

  constructor(testName: string) {
    this.tempDir = join(tmpdir(), `knowhub-test-${testName}-${Date.now()}`);
  }

  async setup(): Promise<void> {
    await mkdir(this.tempDir, { recursive: true });
  }

  async cleanup(): Promise<void> {
    try {
      await rm(this.tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  path(...segments: string[]): string {
    return join(this.tempDir, ...segments);
  }

  async createFile(relativePath: string, content: string): Promise<string> {
    const fullPath = this.path(relativePath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
    return fullPath;
  }

  async createDirectory(relativePath: string): Promise<string> {
    const fullPath = this.path(relativePath);
    await mkdir(fullPath, { recursive: true });
    return fullPath;
  }

  async createSymlink(target: string, linkPath: string): Promise<void> {
    const fullLinkPath = this.path(linkPath);
    await mkdir(join(fullLinkPath, ".."), { recursive: true });
    await symlink(target, fullLinkPath);
  }

  async createConfig(
    config: Record<string, unknown>,
    filename = ".knowhubrc.json",
  ): Promise<string> {
    return this.createFile(filename, JSON.stringify(config, null, 2));
  }
}

export class MockHttpServer {
  private responses = new Map<string, { status: number; content: string }>();

  setResponse(url: string, status: number, content: string): void {
    this.responses.set(url, { status, content });
  }

  getResponse(url: string): { status: number; content: string } | undefined {
    return this.responses.get(url);
  }

  clear(): void {
    this.responses.clear();
  }
}

export const mockHttpServer = new MockHttpServer();

export const mockFetch = async (url: string | URL): Promise<Response> => {
  const urlString = url.toString();
  const mockResponse = mockHttpServer.getResponse(urlString);

  if (!mockResponse) {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }

  return new Response(mockResponse.content, {
    status: mockResponse.status,
    statusText: mockResponse.status === 200 ? "OK" : "Error",
  });
};

export function expectError<T extends Error = Error>(
  fn: () => Promise<unknown>,
  expectedErrorType?: new (...args: unknown[]) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn()
      .then(() => {
        reject(new Error("Expected function to throw an error, but it didn't"));
      })
      .catch((error: unknown) => {
        if (expectedErrorType && !(error instanceof expectedErrorType)) {
          const errorName = expectedErrorType.name;
          const actualName =
            error instanceof Error ? error.constructor.name : typeof error;
          reject(
            new Error(`Expected error type ${errorName}, got ${actualName}`),
          );
        } else {
          resolve(error as T);
        }
      });
  });
}
