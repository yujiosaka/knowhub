# Claude Code Configuration

This document contains instructions for Claude Code to ensure all commits follow Angular commit conventions.

## Commit Message Format

**IMPORTANT**: All commit messages MUST follow the Angular conventional commit format:

```
type(scope): description

[optional body]

[optional footer(s)]
```

### Required Format Rules

1. **Type**: Use lowercase, required
2. **Scope**: Use lowercase, optional but recommended
3. **Description**: 
   - Start with lowercase letter
   - No period at the end
   - Present tense, imperative mood
   - Maximum 72 characters for the entire first line

### Commit Types

Use these commit types (in order of preference):

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries
- `perf`: A code change that improves performance
- `ci`: Changes to CI configuration files and scripts
- `build`: Changes that affect the build system or external dependencies
- `revert`: Reverts a previous commit

### Scope Guidelines

Common scopes for this project:
- `cli`: Command-line interface changes
- `core`: Core knowhub functionality
- `config`: Configuration-related changes
- `plugins`: Plugin system changes
- `sync`: Synchronization functionality
- `templates`: Template-related changes
- `docs`: Documentation changes
- `tests`: Test-related changes
- `deps`: Dependency updates

### Description Guidelines

- Use imperative mood: "add feature" not "added feature"
- Keep it concise but descriptive
- Explain WHAT changed, not HOW
- Start with lowercase letter
- No period at the end

## Examples

### Good Commit Messages

```
feat(cli): add sync command for knowledge files
fix(config): resolve parsing error for nested configurations
docs(readme): update installation instructions
refactor(plugins): simplify plugin registry initialization
test(sync): add integration tests for GitHub plugin
chore(deps): update biome to v1.9.4
style(cli): fix formatting in help command
perf(sync): optimize file processing for large repositories
```

### Bad Commit Messages (DO NOT USE)

```
❌ Update files
❌ Fix bug
❌ Added new feature
❌ WIP: working on sync
❌ Fixed the thing that was broken
❌ docs: Update README.md.
❌ FEAT: Add new command
```

## Additional Guidelines

1. **No WIP commits**: Always complete the work before committing
2. **Single responsibility**: One commit should represent one logical change
3. **Test before commit**: Ensure tests pass before committing
4. **Lint compliance**: Code must pass linting before committing
5. **Release commits**: The project uses semantic-release, so proper commit types are crucial for versioning

## Build and Test Commands

Before committing, ensure:
- `bun run check` passes (Biome linting)
- `bun test` passes (all tests)
- `bun run build` succeeds (TypeScript compilation)

## Special Cases

- Release-related commits starting with `chore(release):` are automatically ignored by commitlint
- Breaking changes should include `BREAKING CHANGE:` in the footer
- Reference issues using `Closes #123` or `Fixes #123` in the footer

## Enforcement

This project uses:
- **commitlint** with `@commitlint/config-conventional` to enforce these rules
- **husky** for git hooks
- **lint-staged** for pre-commit checks

All commits must pass these checks to be accepted.