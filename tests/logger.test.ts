import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ConsoleLogger, TestLogger } from "../src/logger.js";

describe("TestLogger", () => {
  it("captures all log levels", () => {
    const logger = new TestLogger();

    logger.info("info message");
    logger.error("error message");
    logger.warn("warn message");
    logger.success("success message");
    logger.skip("skip message");

    expect(logger.logs).toHaveLength(5);
    expect(logger.logs[0]).toEqual({ level: "info", message: "info message" });
    expect(logger.logs[1]).toEqual({
      level: "error",
      message: "error message",
    });
    expect(logger.logs[2]).toEqual({ level: "warn", message: "warn message" });
    expect(logger.logs[3]).toEqual({
      level: "success",
      message: "success message",
    });
    expect(logger.logs[4]).toEqual({ level: "skip", message: "skip message" });
  });

  it("filters messages by level", () => {
    const logger = new TestLogger();

    logger.info("info 1");
    logger.error("error 1");
    logger.info("info 2");
    logger.success("success 1");

    expect(logger.getMessages("info")).toEqual(["info 1", "info 2"]);
    expect(logger.getMessages("error")).toEqual(["error 1"]);
    expect(logger.getMessages("success")).toEqual(["success 1"]);
    expect(logger.getMessages("warn")).toEqual([]);
  });

  it("returns all messages when no level specified", () => {
    const logger = new TestLogger();

    logger.info("message 1");
    logger.error("message 2");

    expect(logger.getMessages()).toEqual(["message 1", "message 2"]);
  });

  it("clears logs", () => {
    const logger = new TestLogger();

    logger.info("message");
    expect(logger.logs).toHaveLength(1);

    logger.clear();
    expect(logger.logs).toHaveLength(0);
  });
});

describe("ConsoleLogger", () => {
  let originalConsole: Console;

  beforeEach(() => {
    originalConsole = global.console;
    global.console = {
      ...console,
      log: () => {},
      error: () => {},
      warn: () => {},
    } as Console;
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  it("does not throw when quiet is false", () => {
    const logger = new ConsoleLogger(false);

    expect(() => {
      logger.info("test");
      logger.error("test");
      logger.warn("test");
      logger.success("test");
      logger.skip("test");
    }).not.toThrow();
  });

  it("does not throw when quiet is true", () => {
    const logger = new ConsoleLogger(true);

    expect(() => {
      logger.info("test");
      logger.error("test");
      logger.warn("test");
      logger.success("test");
      logger.skip("test");
    }).not.toThrow();
  });
});
