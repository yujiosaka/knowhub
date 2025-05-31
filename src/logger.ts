export interface Logger {
  info(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  success(message: string): void;
  skip(message: string): void;
}

export class ConsoleLogger implements Logger {
  constructor(private quiet = false) {}

  info(message: string): void {
    if (!this.quiet) {
      console.log(message);
    }
  }

  error(message: string): void {
    if (!this.quiet) {
      console.error(message);
    }
  }

  warn(message: string): void {
    if (!this.quiet) {
      console.warn(message);
    }
  }

  success(message: string): void {
    if (!this.quiet) {
      console.log(message);
    }
  }

  skip(message: string): void {
    if (!this.quiet) {
      console.log(message);
    }
  }
}

export class TestLogger implements Logger {
  public logs: Array<{ level: string; message: string }> = [];

  info(message: string): void {
    this.logs.push({ level: "info", message });
  }

  error(message: string): void {
    this.logs.push({ level: "error", message });
  }

  warn(message: string): void {
    this.logs.push({ level: "warn", message });
  }

  success(message: string): void {
    this.logs.push({ level: "success", message });
  }

  skip(message: string): void {
    this.logs.push({ level: "skip", message });
  }

  clear(): void {
    this.logs = [];
  }

  getMessages(level?: string): string[] {
    if (level) {
      return this.logs
        .filter((log) => log.level === level)
        .map((log) => log.message);
    }
    return this.logs.map((log) => log.message);
  }
}
