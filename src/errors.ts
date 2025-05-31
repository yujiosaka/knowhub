export class KnowhubError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "KnowhubError";
  }
}

export class ConfigurationError extends KnowhubError {
  constructor(
    message: string,
    public configPath?: string,
  ) {
    super(message);
    this.name = "ConfigurationError";
    this.code = "CONFIG_ERROR";
  }
}

export class ResourceError extends KnowhubError {
  constructor(
    message: string,
    public resourcePath?: string,
  ) {
    super(message);
    this.name = "ResourceError";
    this.code = "RESOURCE_ERROR";
  }
}

export class ValidationError extends KnowhubError {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
    this.code = "VALIDATION_ERROR";
  }
}

export class FileOperationError extends KnowhubError {
  constructor(
    message: string,
    public filePath?: string,
    public operation?: string,
  ) {
    super(message);
    this.name = "FileOperationError";
    this.code = "FILE_ERROR";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function handleNodeError(
  error: unknown,
  path: string,
  operation: string,
): never {
  const nodeError = error as NodeJS.ErrnoException;

  switch (nodeError.code) {
    case "ENOENT":
      throw new FileOperationError(
        `Path does not exist: ${path}`,
        path,
        operation,
      );
    case "EACCES":
      throw new FileOperationError(
        `No permission to access path: ${path}`,
        path,
        operation,
      );
    case "EPERM":
      throw new FileOperationError(
        `Operation not permitted: ${path}`,
        path,
        operation,
      );
    default: {
      const message = error instanceof Error ? error.message : String(error);
      throw new FileOperationError(
        `${operation} failed for "${path}": ${message}`,
        path,
        operation,
      );
    }
  }
}
