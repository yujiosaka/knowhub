import cli from "./cli.js";

cli().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
