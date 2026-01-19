# SuperTokens Core - Node.js with Express

Open-source authentication provider implemented in Node.js with Express.

This is a homologous version of the SuperTokens Core originally built in Java. It maintains the same architecture and features while leveraging Node.js and Express for the backend.

## Features

- **Passwordless Login**: SMS/Email based authentication
- **Email Password Login**: Traditional email and password authentication
- **Social Login**: OAuth2 integration with social providers
- **Session Management**: Secure token-based session handling
- **Multi-Factor Authentication**: TOTP and other MFA methods
- **Multi-Tenancy**: Organization and tenant support
- **User Roles**: Role-based access control (RBAC)
- **User Metadata**: Flexible user data storage
- **Account Linking**: Link multiple accounts to a single user
- **Email Verification**: Email verification workflows
- **JWT Management**: Secure JWT token generation and validation

## Architecture

```
SuperTokens Core (Node.js)
├── Express Server
├── Authentication Layer
│   ├── Email/Password
│   ├── Passwordless
│   ├── Social/OAuth
│   ├── SAML
│   └── WebAuthn
├── Session Management
├── Multi-Tenancy
├── User Management
└── Storage Layer
    ├── MySQL
    ├── PostgreSQL
    └── SQLite
```

## Requirements

- Node.js >= 18.0.0
- npm or yarn
- One of: MySQL, PostgreSQL, or SQLite

## Installation

1. Clone the repository:
```bash
git clone https://github.com/supertokens/supertokens-core-node.git
cd supertokens-core-node
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update configuration files:
- Edit `.env` for environment variables
- Edit `config.yaml` for service configuration

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start in development mode with hot reload
npm run dev:watch

# Or start in development mode without watch
npm run dev
```

### Production

```bash
# Build the TypeScript
npm run build

# Start the server
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Watch mode
npm test:watch
```

### Linting & Formatting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Configuration

### Environment Variables

See `.env.example` for all available environment variables.

### Configuration File

Edit `config.yaml` to customize:
- Database settings
- JWT configuration
- Token validity periods
- Email settings
- CORS settings
- Feature flags

## Project Structure

```
src/
├── index.ts                 # Entry point
├── server.ts                # Express server setup
├── config/                  # Configuration management
│   ├── index.ts
│   ├── database.ts
│   └── constants.ts
├── database/                # Database layer
│   ├── connection.ts
│   ├── migrations.ts
│   └── repositories/
├── middleware/              # Express middleware
│   ├── auth.ts
│   ├── errorHandler.ts
│   └── logging.ts
├── routes/                  # API routes
│   ├── index.ts
│   ├── auth/
│   ├── session/
│   ├── user/
│   ├── tenant/
│   ├── role/
│   └── metadata/
├── services/                # Business logic
│   ├── auth/
│   ├── session/
│   ├── user/
│   ├── email/
│   ├── jwt/
│   └── crypto/
├── exceptions/              # Custom exceptions
├── types/                   # TypeScript types
├── utils/                   # Utility functions
└── tests/                   # Test files
```

## Database Setup

### MySQL

```sql
CREATE DATABASE supertokens;
CREATE USER 'supertokens'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON supertokens.* TO 'supertokens'@'localhost';
FLUSH PRIVILEGES;
```

### PostgreSQL

```sql
CREATE DATABASE supertokens;
CREATE USER supertokens WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE supertokens TO supertokens;
```

### SQLite

No setup needed - database file will be created automatically.

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user account
- `POST /auth/signin` - Sign in user
- `POST /auth/signout` - Sign out user
- `POST /auth/refresh` - Refresh access token

### Session Management
- `GET /session/verify` - Verify session
- `POST /session/refresh` - Refresh session
- `POST /session/revoke` - Revoke session

### User Management
- `GET /user/:userId` - Get user details
- `PUT /user/:userId` - Update user
- `DELETE /user/:userId` - Delete user

### Email Verification
- `POST /email-verification/send` - Send verification email
- `POST /email-verification/verify` - Verify email token

### Passwordless
- `POST /passwordless/code` - Request passwordless code
- `POST /passwordless/verify` - Verify passwordless code

### Multi-Tenancy
- `POST /tenant` - Create tenant
- `GET /tenant/:tenantId` - Get tenant details

### User Roles
- `POST /role` - Create role
- `POST /user/:userId/role` - Assign role to user

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://supertokens.io/docs)
- 💬 [Discord Community](https://supertokens.io/discord)
- 🐛 [Issue Tracker](https://github.com/supertokens/supertokens-core-node/issues)

## Authors

Original SuperTokens team - Ported to Node.js with Express

---

**Note**: This is a homologous port of the original SuperTokens Core (Java). It maintains API compatibility and feature parity with the original implementation.
