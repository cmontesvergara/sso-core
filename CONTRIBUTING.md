# Contributing to SuperTokens Core Node.js

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/supertokens-core-node.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

```bash
npm install
npm run dev:watch
```

## Code Guidelines

- Use TypeScript for all new code
- Follow the existing code style
- Write tests for new features
- Update documentation as needed

## Making Changes

1. Make your changes in the feature branch
2. Test your changes: `npm test`
3. Lint your code: `npm run lint:fix`
4. Format your code: `npm run format`
5. Commit with clear messages: `git commit -m "feat: add new feature"`

## Commit Messages

Use conventional commits:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation only changes
- `style:` - Changes that don't affect code meaning (whitespace, formatting, etc.)
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `perf:` - Code change that improves performance
- `test:` - Adding missing tests or correcting existing tests

## Submitting Changes

1. Push to your fork: `git push origin feature/your-feature-name`
2. Create a Pull Request on GitHub
3. Provide a clear description of the changes
4. Reference any related issues: `Fixes #123`

## Reporting Issues

Before creating an issue, please:

- Check existing issues to avoid duplicates
- Provide a clear title and description
- Include steps to reproduce (for bugs)
- Include your environment details (Node version, OS, etc.)

## Code Review

All submissions require review. We use GitHub pull requests for this purpose. Consult GitHub Help for more information on using pull requests.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
