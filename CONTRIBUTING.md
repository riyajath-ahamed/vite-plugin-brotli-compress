# Contributing to vite-plugin-brotli-compress

Thank you for your interest in contributing to `vite-plugin-brotli-compress`! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Release Process](#release-process)
- [GitHub Workflows](#github-workflows)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold this code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vite-plugin-brotli-compress.git
   cd vite-plugin-brotli-compress
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/riyajath-ahamed/vite-plugin-brotli-compress.git
   ```

## Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

3. **Build the package**:
   ```bash
   npm run build
   ```

## Making Changes

1. **Create a new branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-fix-name
   ```

2. **Make your changes** following the coding standards:
   - Use TypeScript for all new code
   - Follow existing code style and patterns
   - Add JSDoc comments for public APIs
   - Ensure backward compatibility when possible

3. **Test your changes**:
   ```bash
   npm run test:run
   npm run test:coverage
   ```

## Testing

We use Vitest for testing. The test suite includes:

- **Unit tests** (`src/__tests__/plugin.test.ts`)
- **Integration tests** (`src/__tests__/integration.test.ts`)
- **Performance tests** (`src/__tests__/performance.test.ts`)
- **Utility tests** (`src/__tests__/utils.test.ts`)

### Running Tests

```bash
# Run all tests
npm test

# Run tests once (no watch mode)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui

# Run specific test files
npm test -- --grep "integration"
```

### Writing Tests

- Write tests for new features
- Ensure existing tests still pass
- Aim for high test coverage
- Test edge cases and error conditions

## Release Process

This project uses automated versioning and releases through GitHub Actions. There are three ways to trigger releases:

### 1. Automated Versioning (Recommended)

The project automatically detects version bumps based on commit message conventions:

- **Minor version** (`1.0.0` → `1.1.0`): `feat:` or `feature:` commits
- **Patch version** (`1.0.0` → `1.0.1`): `fix:`, `bugfix:`, `chore:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:` commits
- **Major version** (`1.0.0` → `2.0.0`): Commits with `BREAKING CHANGE` or `breaking change`

**Dynamic Release Notes**: Release notes are automatically generated from commit messages since the last tag, ensuring accurate and up-to-date changelogs.

### 2. Manual Release

Use the GitHub Actions "Manual Release" workflow:

1. Go to **Actions** → **Manual Release**
2. Click **Run workflow**
3. Select version type (patch/minor/major)
4. Choose whether to create GitHub release
5. Click **Run workflow**

**Dynamic Release Notes**: Manual releases also generate changelogs automatically from commit history.

### 3. Tag-based Release

Create and push a version tag:

```bash
git tag v1.1.0
git push origin v1.1.0
```

## GitHub Workflows

The project includes several GitHub Actions workflows:

### 1. CI Workflow (`.github/workflows/ci.yml`)
- Runs on every push and pull request
- Tests on Node.js 18, 20, and 22
- Runs linting, type checking, and tests
- Generates coverage reports

### 2. Release Workflow (`.github/workflows/release.yml`)
- Triggers on version tags (`v*`)
- Runs tests and builds package
- Publishes to npm automatically
- Creates GitHub releases with detailed changelog

### 3. Manual Release Workflow (`.github/workflows/manual-release.yml`)
- Manual trigger with version type selection
- Automated version bumping and tagging
- Optional GitHub release creation
- Full CI/CD pipeline

### 4. Automated Versioning Workflow (`.github/workflows/version.yml`)
- Triggers on pushes to main branch
- Analyzes commit messages for version bumps
- Automatically bumps version and creates tags
- Creates release pull requests

## Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

### Examples
```bash
feat: add gzip compression support
fix: handle edge case in file filtering
docs: update README with new examples
chore: bump version to 1.1.0
```

### Breaking Changes
For breaking changes, add `BREAKING CHANGE:` in the footer:
```bash
feat!: redesign plugin API

BREAKING CHANGE: The plugin configuration API has been redesigned
```

## Pull Request Process

1. **Ensure your branch is up to date**:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Push your changes**:
   ```bash
   git push origin your-branch
   ```

3. **Create a Pull Request** on GitHub:
   - Use a clear, descriptive title
   - Reference any related issues
   - Provide a detailed description of changes
   - Include screenshots for UI changes

4. **Wait for review**:
   - All CI checks must pass
   - At least one maintainer must approve
   - Address any requested changes

5. **Merge**:
   - Use "Squash and merge" for most PRs
   - Use "Merge commit" for complex features with multiple commits

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing patterns and conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Error Handling
- Handle errors gracefully
- Provide meaningful error messages
- Use appropriate error types
- Log errors when necessary

### Performance
- Consider performance implications
- Use streaming for large files
- Implement parallel processing where appropriate
- Add performance tests for critical paths

### Backward Compatibility
- Maintain backward compatibility when possible
- Use deprecation warnings for breaking changes
- Document migration paths
- Version breaking changes appropriately

## Getting Help

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and general discussion
- **Documentation**: Check the README.md for usage examples

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to `vite-plugin-brotli-compress`! 🚀
