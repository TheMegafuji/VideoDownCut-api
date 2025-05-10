# Contributing to VideoDownCut

Thank you for your interest in contributing to VideoDownCut! This document provides guidelines and instructions to help you contribute effectively.

## Code of Conduct

Please help keep this project open and inclusive. By participating, you agree to:

- Be respectful and considerate in your communication
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js (v14+)
- FFmpeg
- yt-dlp
- PostgreSQL (or Docker)

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/VideoDownCut-api.git
   cd VideoDownCut-api
   ```

3. Add the original repository as a remote:
   ```bash
   git remote add upstream https://github.com/TheMegafuji/VideoDownCut-api.git
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Copy the environment file and update with your settings:
   ```bash
   cp .env.example .env
   ```

6. Start the development server:
   ```bash
   # Using Docker (recommended)
   npm run docker:dev
   
   # Without Docker
   npm run dev
   ```

## Development Workflow

### Branching Strategy

- `main`: Production-ready code
- `develop`: Latest development changes
- Feature branches: Named as `feature/your-feature-name`
- Bugfix branches: Named as `fix/issue-description`

Always create new branches from `develop`:

```bash
git checkout develop
git pull upstream develop
git checkout -b feature/your-feature-name
```

### Coding Standards

This project uses ESLint and Prettier for code quality and formatting.

- Run linting: `npm run lint`
- Fix linting issues: `npm run lint:fix`
- Format code: `npm run format`
- Validate code: `npm run validate`

See [PRETTIER.md](PRETTIER.md) for more details on code formatting.

#### TypeScript Guidelines

- Use TypeScript's type system effectively
- Create interfaces for API requests and responses
- Document complex functions with JSDoc comments
- Follow the existing project structure and patterns

### Commit Conventions

Please follow these commit message guidelines:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line

### Testing

Currently, the project does not have formal tests. When adding new features, please thoroughly test manually and consider adding automated tests.

## Pull Request Process

1. Update the README.md with details of significant changes
2. Run `npm run validate` to ensure code quality
3. Create a pull request to the `develop` branch
4. Ensure the PR description clearly describes the changes and references any related issues
5. Wait for review and address any comments

## Reporting Issues

When reporting issues, please include:

1. Clear and descriptive title
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Screenshots (if applicable)
6. Environment details (OS, Node.js version, etc.)
7. Any relevant logs or error messages

## Feature Requests

Feature requests are welcome. Please provide:

1. Clear description of the feature
2. Rationale for adding the feature
3. If possible, a rough implementation plan

## License

By contributing to VideoDownCut, you agree that your contributions will be licensed under the project's ISC license.

## Questions?

If you have questions about contributing, please open an issue with your question.

Thank you for contributing to VideoDownCut!
