# Architecture Overview - SSO Backend v2

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
│               (Web, Mobile, Third-party Services)           │
└────────────────────────────┬────────────────────────────────┘
                             │
                    HTTP/HTTPS (REST API)
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
┌───────▼─────────────────────────────────────────▼──────┐
│                   Express Application                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────┐       │
│  │          Security Layer (Helmet)            │       │
│  ├─────────────────────────────────────────────┤       │
│  │    CORS | CSP | HSTS | X-Frame-Options      │       │
│  └─────────────────────────────────────────────┘       │
│                         ▲                               │
│  ┌──────────────────────┴──────────────────────┐       │
│  │    Request Processing Pipeline              │       │
│  ├──────────────────────────────────────────────┤       │
│  │ 1. Rate Limiting (express-rate-limit)      │       │
│  │ 2. Body Parser (JSON, urlencoded)          │       │
│  │ 3. Cookie Parser                           │       │
│  │ 4. Request Logging                         │       │
│  └──────────────────────────────────────────────┘       │
│                         ▲                               │
│  ┌──────────────────────┴──────────────────────┐       │
│  │        Route Handlers (Controllers)          │       │
│  ├──────────────────────────────────────────────┤       │
│  │                                              │       │
│  │  /api/v1/auth         (signup, signin)     │       │
│  │  /api/v1/otp          (2FA)                │       │
│  │  /api/v1/email-*      (verification)       │       │
│  │  /api/v1/session      (management)         │       │
│  │  /.well-known/jwks.json  (JWKS)            │       │
│  │                                              │       │
│  └──────────────────────────────────────────────┘       │
│                         ▲                               │
│  ┌──────────────────────┴──────────────────────┐       │
│  │      Service Layer (Business Logic)         │       │
│  ├──────────────────────────────────────────────┤       │
│  │                                              │       │
│  │  AuthService                                │       │
│  │    ├─ signup(email, password, ...)         │       │
│  │    ├─ signin(email, password)              │       │
│  │    └─ password validation (Argon2)         │       │
│  │                                              │       │
│  │  SessionService                             │       │
│  │    ├─ generateRefreshToken()                │       │
│  │    ├─ rotateRefreshToken()                 │       │
│  │    ├─ revokeRefreshToken()                 │       │
│  │    └─ detect token reuse                    │       │
│  │                                              │       │
│  │  JWTService (RS256)                         │       │
│  │    ├─ sign(payload) → JWT                  │       │
│  │    ├─ verify(token) → payload              │       │
│  │    └─ getJWKS() → public keys              │       │
│  │                                              │       │
│  │  OTPService (TOTP)                          │       │
│  │    ├─ generateSecret() → QR Code           │       │
│  │    ├─ verifyOTP() → activate 2FA           │       │
│  │    └─ validateOTP() → login validation     │       │
│  │                                              │       │
│  │  EmailService (Nodemailer)                  │       │
│  │    ├─ initialize(SMTP config)              │       │
│  │    ├─ sendVerification()                   │       │
│  │    └─ sendPasswordReset()                  │       │
│  │                                              │       │
│  │  PrismaService                              │       │
│  │    ├─ getPrismaClient()                    │       │
│  │    └─ setPrismaUserContext() → RLS         │       │
│  │                                              │       │
│  └──────────────────────────────────────────────┘       │
│                         ▲                               │
│  ┌──────────────────────┴──────────────────────┐       │
│  │   Repository Layer (Data Access)            │       │
│  ├──────────────────────────────────────────────┤       │
│  │                                              │       │
│  │  userRepo.prisma.ts                         │       │
│  │    ├─ createUser()                          │       │
│  │    ├─ findUserByEmail()                    │       │
│  │    └─ findUserById()                        │       │
│  │                                              │       │
│  │  refreshTokenRepo.prisma.ts                 │       │
│  │    ├─ saveRefreshToken()                   │       │
│  │    ├─ findRefreshTokenByHash()             │       │
│  │    ├─ revokeRefreshTokenById()             │       │
│  │    └─ revokeAllRefreshTokensForUser()      │       │
│  │                                              │       │
│  │  otpSecretRepo.prisma.ts                    │       │
│  │    ├─ findOTPSecretByUserId()              │       │
│  │    └─ updateBackupCodes()                  │       │
│  │                                              │       │
│  │  emailVerificationRepo.prisma.ts            │       │
│  │    ├─ findEmailVerificationByToken()       │       │
│  │    └─ markEmailVerificationAsVerified()    │       │
│  │                                              │       │
│  └──────────────────────────────────────────────┘       │
│                         ▲                               │
│  ┌──────────────────────┴──────────────────────┐       │
│  │  ORM Layer - Prisma Type-Safe Queries       │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
└───────────────────────────────┬──────────────────────────┘
                                │
                    PostgreSQL Protocol (TCP 5432)
                                │
                ┌───────────────┴────────────────┐
                │                                │
    ┌───────────▼─────────────┐    ┌────────────▼──────────┐
    │   PostgreSQL Database   │    │  RLS Context (Row     │
    ├───────────────────────────┤    │  Level Security)      │
    │                           │    │                       │
    │  Tables (with RLS):       │    │  current_setting(     │
    │  ├─ users                 │    │    'app.current_      │
    │  ├─ refresh_tokens        │    │    user_id'           │
    │  ├─ otp_secrets           │    │  )                    │
    │  ├─ email_verifications   │    │                       │
    │  ├─ tenants              │    │  Filters all queries  │
    │  ├─ tenant_members       │    │  to user's records    │
    │  ├─ roles                │    │  automatically        │
    │  └─ permissions          │    │                       │
    │                           │    │                       │
    │  Indices:                │    │                       │
    │  ├─ users.email (unique) │    │                       │
    │  ├─ refresh_tokens.hash  │    │                       │
    │  ├─ otp_secrets.user_id  │    │                       │
    │  └─ email_*.token        │    │                       │
    │                           │    │                       │
    │  Migrations:             │    │                       │
    │  ├─ 001_init.js          │    │                       │
    │  └─ 002_otp_email        │    │                       │
    │                           │    │                       │
    └───────────────────────────┘    └────────────┬──────────┘
                                                  │
                            node-pg-migrate
                            (Schema Management)
```

---

## Data Flow: Authentication Signup

```
Client Request
    │
    ▼
POST /api/v1/auth/signup
    │
    ├─ Helmet: Security headers
    ├─ CORS: Check origin
    ├─ Rate Limiter: 5/hour
    ├─ Body Parser: Parse JSON
    │
    ▼
Joi Validation
    ├─ email: RFC 5322 + lowercase + trim
    ├─ password: ≥ 8 chars
    └─ firstName/lastName: optional
         │
         ├─ PASS → continue
         └─ FAIL → 400 VALIDATION_ERROR
              │
              ▼
         Return error response
              │
              ▼
         Client receives error
    │
    ▼ (PASS)
AuthService.signup()
    │
    ├─ Check if email exists
    │  └─ userRepo.findUserByEmail() → Prisma query
    │     └─ Database SELECT
    │
    ├─ IF exists → 409 USER_ALREADY_EXISTS
    │  └─ Return error
    │
    ├─ Hash password with Argon2
    │  └─ argon2.hash(password) → hash string
    │
    ├─ Create user record
    │  └─ userRepo.createUser(email, hash, firstName, lastName)
    │     └─ Prisma INSERT
    │        └─ Database: INSERT INTO users ...
    │           Returns: User record with userId
    │
    ├─ Generate refresh token (opaque UUID)
    │  └─ SessionService.generateRefreshToken()
    │     ├─ uuidv4() → token
    │     ├─ Hash token: crypto.createHash('sha256')(token + PEPPER)
    │     ├─ Save to DB: refreshTokenRepo.saveRefreshToken()
    │     │  └─ Prisma INSERT into refresh_tokens
    │     │     ├─ user_id = userId
    │     │     ├─ token_hash = hashed_token
    │     │     ├─ expires_at = now + 7 days
    │     │     └─ created_at = now
    │     └─ Return: plaintext token (not hash!)
    │
    ├─ Generate JWT (RS256)
    │  └─ JWTService.sign(payload)
    │     ├─ Payload: { sub: userId, email, iat, exp }
    │     ├─ Sign with RSA private key
    │     └─ Return: JWT signed token
    │
    ▼ (ALL SUCCESS)
Build response
    │
    ├─ userId
    ├─ email
    ├─ firstName/lastName
    ├─ accessToken (JWT)
    └─ refreshToken (UUID opaque)
         │
         ▼
    JSON response (201)
         │
         ├─ Set-Cookie: refreshToken (optional)
         ├─ Content-Type: application/json
         └─ X-RateLimit-Remaining: 4
         │
         ▼
    Client receives credentials
```

---

## Data Flow: Refresh Token Rotation

```
Client sends
    │
    ▼
POST /api/v1/auth/refresh
    │
    ├─ Rate Limiter: 30/min
    ├─ Joi Validation: token format
    │
    ▼
SessionService.rotateRefreshToken(token)
    │
    ├─ Hash token: crypto.createHash(token + PEPPER)
    │
    ├─ Lookup in DB
    │  └─ refreshTokenRepo.findRefreshTokenByHash(hash)
    │     └─ Prisma SELECT FROM refresh_tokens WHERE token_hash = ?
    │
    ├─ IF not found → 404 TOKEN_NOT_FOUND
    │
    ├─ IF found, check properties
    │  ├─ IF revoked=true → 401 TOKEN_REVOKED
    │  ├─ IF expires_at < now → 401 TOKEN_EXPIRED
    │  └─ IF previousTokenId matches revoked token → REUSE DETECTED!
    │     └─ 401 SECURITY_INCIDENT
    │        └─ Prisma: UPDATE refresh_tokens SET revoked=true
    │           WHERE user_id = userId (revoke ALL)
    │
    ├─ Revoke current token
    │  └─ Prisma: UPDATE refresh_tokens SET revoked=true WHERE id = ?
    │
    ├─ Generate new token
    │  ├─ uuidv4() → newToken
    │  ├─ Hash it
    │  ├─ Save to DB with previousTokenId = oldToken.id
    │  └─ Prisma: INSERT INTO refresh_tokens (...)
    │
    ├─ Generate new JWT
    │  └─ JWTService.sign(new payload with fresh exp)
    │
    ▼ (SUCCESS)
Return response
    │
    ├─ accessToken (new JWT)
    ├─ refreshToken (new opaque token)
    │
    ▼
Client stores both tokens
    ├─ Access token: memory or short-term storage
    └─ Refresh token: httpOnly secure cookie (recommended)
```

---

## Security Layers

### Layer 1: Network Security
- HTTPS/TLS (enforced in prod)
- Helmet headers (CSP, HSTS, X-Frame-Options, etc.)

### Layer 2: Authentication
- JWT RS256: asymmetric signing
- JWKS endpoint: public key distribution
- Access tokens: short-lived (15 min default)
- Refresh tokens: long-lived, opaque, hashed

### Layer 3: Password Security
- Argon2id: resistant to GPU/ASIC attacks
- Async hashing: no blocking
- Per-user salt: built into Argon2

### Layer 4: Token Protection
- Refresh token rotation: forced rotation on use
- Token reuse detection: revoke all on reuse
- Pepper: additional secret before hashing
- Expiration: automatic invalidation

### Layer 5: Multi-Factor Authentication
- TOTP: Time-based One-Time Password
- Backup codes: fallback authentication
- 30-second time window: clock skew tolerance

### Layer 6: Email Verification
- One-time tokens (UUID)
- Expiration: 24 hours
- Single use: consumed on verify
- Transport: Nodemailer with TLS

### Layer 7: Rate Limiting
- Per-endpoint: signup, signin, refresh, signout
- Global: 100 req/min default
- Configurable: via config.yaml

### Layer 8: Database Security
- RLS policies: automatic row-level access control
- Field-level: Prisma doesn't expose sensitive data
- Audit trail: timestamp all records
- Encryption: use PostgreSQL pgcrypto for sensitive data

### Layer 9: Input Validation
- Schema validation: Joi
- Type checking: TypeScript strict mode
- Sanitization: lowercase emails, trim whitespace
- Error messages: no information leakage

### Layer 10: Logging & Monitoring
- JSON logs: machine parseable
- Levels: DEBUG, INFO, WARN, ERROR
- Sensitive data: no passwords/tokens in logs
- Audit events: all auth operations logged

---

## Deployment Topology (Future)

```
┌─────────────────────────────────────────┐
│         Load Balancer (ALB/NLB)         │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┼─────────┐
     │         │         │
     ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│  App 1  │ │  App 2  │ │  App 3  │  (Auto-scaling)
│ :3000   │ │ :3000   │ │ :3000   │
└────┬────┘ └────┬────┘ └────┬────┘
     │         │         │
     └─────────┼─────────┘
               │
        ┌──────▼──────┐
        │   Redis     │  (Session cache)
        │  Cluster    │
        └──────┬──────┘
               │
        ┌──────▼──────────────┐
        │  PostgreSQL Primary │
        │  + Replicas (RO)    │
        └─────────────────────┘
```

---

## Decision Records

### Why Prisma + node-pg-migrate (Hybrid)?
- **Separation**: Schema (migrations) vs ORM (runtime)
- **Flexibility**: SQL control + productivity of ORM
- **RLS native**: PostgreSQL policies in SQL
- **Type-safety**: Prisma generates types from schema
- **Versioning**: node-pg-migrate tracks all DDL changes

### Why RS256 (RSA) for JWT?
- **Public verification**: JWKS endpoint for clients
- **Key rotation**: Easy to rotate private key without invalidating tokens
- **Industry standard**: Widely supported
- **Asymmetric**: Private key never shared with clients

### Why Opaque Refresh Tokens?
- **Security**: Cannot be decoded/modified by client
- **Revocation**: Database can revoke anytime
- **Rotation**: Forced rotation on use
- **Reuse detection**: Detect token theft

### Why Argon2id?
- **Modern**: Resistant to GPU/ASIC attacks
- **Adaptive**: Time/memory costs configurable
- **Async**: Doesn't block event loop
- **Standard**: OWASP recommendation

### Why RLS (Row Level Security)?
- **Automatic**: Database enforces access control
- **No bypasses**: Application cannot accidentally leak data
- **Performance**: Filters at storage layer
- **Compliance**: Helps with GDPR/data localization

---

## Performance Considerations

### Database Optimization
- Indices: email, token_hash, user_id, created_at
- Connection pooling: PgBouncer (future)
- Query optimization: Prisma relation loading

### Application Optimization
- Token caching: Redis for session cache (future)
- Rate limiting: In-memory store (expr-rate-limit)
- JWT verification: No DB hit (uses JWKS)

### Scalability
- Stateless: No server-side session state
- Horizontal scaling: Easy to add more instances
- Distributed RLS: PostgreSQL handles multi-tenant isolation

---

**Last Updated**: 12 de enero de 2026
