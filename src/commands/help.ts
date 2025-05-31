const HELP = `
knowhub - Synchronize AI coding–agent knowledge files (rules, templates, guidelines) across your project

USAGE:
  npx knowhub [COMMAND] [OPTIONS]

COMMANDS:
  (default)    Sync resources according to configuration
  init         Create a configuration template

OPTIONS:
  -c, --config <path>     Path to configuration file
  -d, --dry-run          Show what would be done without making changes
  -q, --quiet            Suppress all output
  -h, --help             Show this help message
  -v, --version          Show version information

EXAMPLES:
  npx knowhub                           # Sync resources
  npx knowhub --dry-run                 # Preview sync operation
  npx knowhub --quiet                   # Sync without output
  npx knowhub --config ./my-config.yaml # Use custom config
  npx knowhub init                      # Create configuration template

For more information, visit: https://github.com/yujiosaka/knowhub
`;

export default function help(): void {
  console.log(HELP.trim());
}
