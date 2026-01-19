# API Reference - SSO Backend v2

## Base URL
```
http://localhost:3000
```

## Authentication
Incluir JWT en header `Authorization`:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleTEifQ...
```

---

## System Endpoints

### GET /health
Check server health.
```bash
curl http://localhost:3000/health
```

**Response** (200):
```json
{
  "status": "OK",
  "timestamp": "2026-01-12T10:30:45.123Z"
}
```

---

### GET /ready
Check readiness (JWKS initialized).
```bash
curl http://localhost:3000/ready
```

**Response** (200):
```json
{
  "status": "OK",
  "timestamp": "2026-01-12T10:30:45.123Z"
}
```

---

### GET /.well-known/jwks.json
Obtain public JWKS for token verification.
```bash
curl http://localhost:3000/.well-known/jwks.json
```

**Response** (200):
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "key1",
      "n": "xGOr+AIEOe6NVt1CgFGJ0B5zc...",
      "e": "AQAB"
    }
  ]
}
```

---

## Auth Endpoints (`/api/v1/auth`)

### POST /signup
Create new user account.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response** (201):
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleTEifQ...",
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e"
}
```

**Errors**:
- 400: `VALIDATION_ERROR` - Email or password invalid
- 409: `USER_ALREADY_EXISTS` - User with this email exists

**Rate Limit**: 5 per hour

---

### POST /signin
Sign in user.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response** (200):
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleTEifQ...",
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e",
  "otpRequired": false
}
```

**Response** (200) - OTP required:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "otpRequired": true
}
```

**Errors**:
- 400: `VALIDATION_ERROR` - Missing email or password
- 401: `INVALID_CREDENTIALS` - Wrong password
- 404: `USER_NOT_FOUND` - User doesn't exist

**Rate Limit**: 10 per 15 minutes

---

### POST /refresh
Refresh access token.

**Request**:
```json
{
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e"
}
```

**Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleTEifQ...",
  "refreshToken": "new-refresh-token-uuid"
}
```

**Errors**:
- 400: `INVALID_TOKEN` - Token format invalid
- 401: `TOKEN_EXPIRED` - Refresh token expired
- 401: `TOKEN_REVOKED` - Refresh token was revoked
- 401: `TOKEN_REUSE_DETECTED` - Token reuse (security incident)

**Rate Limit**: 30 per minute

---

### POST /signout
Sign out user.

**Request**:
```json
{
  "refreshToken": "ebd0e7ba-91a5-4a9e-8d6e-3f8c2a1b9d4e",
  "revokeAll": false
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

**Parameters**:
- `refreshToken`: Token to revoke
- `revokeAll` (optional): If true, revoke all user's tokens (default: false)

**Errors**:
- 400: `INVALID_TOKEN` - Token format invalid
- 404: `TOKEN_NOT_FOUND` - Token doesn't exist

**Rate Limit**: 60 per minute

---

## OTP Endpoints (`/api/v1/otp`)

### POST /generate
Generate OTP secret and QR code.

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

**Response** (200):
```json
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "backupCodes": [
    "A1B2C3D4",
    "E5F6G7H8",
    "I9J0K1L2",
    "M3N4O5P6",
    "Q7R8S9T0",
    "U1V2W3X4",
    "Y5Z6A7B8",
    "C9D0E1F2",
    "G3H4I5J6",
    "K7L8M9N0"
  ],
  "message": "OTP secret generated. Scan the QR code..."
}
```

**Errors**:
- 400: `VALIDATION_ERROR` - Invalid userId or email
- 409: `OTP_ALREADY_ENABLED` - User already has OTP enabled

---

### POST /verify
Verify OTP token and enable 2FA.

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "123456"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "OTP verified and enabled"
}
```

**Errors**:
- 400: `VALIDATION_ERROR` - Invalid format
- 401: `INVALID_OTP` - Invalid OTP token

---

### POST /validate
Validate OTP during login.

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "123456"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "OTP token is valid"
}
```

**Errors**:
- 401: `INVALID_OTP` - Invalid token or OTP not enabled

---

### POST /backup-code
Use backup code instead of OTP.

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "A1B2C3D4"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Backup code used successfully"
}
```

**Errors**:
- 401: `INVALID_BACKUP_CODE` - Invalid or already used

---

### POST /disable
Disable OTP for user.

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "OTP disabled"
}
```

---

### GET /status/:userId
Check if OTP is enabled.

**Response** (200):
```json
{
  "enabled": true,
  "message": "OTP is enabled"
}
```

---

## Email Verification Endpoints (`/api/v1/email-verification`)

### POST /send
Send email verification link.

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Notes**: 
- Email expires in 24 hours
- In dev mode, uses Ethereal test account (check preview URL in logs)

---

### POST /verify
Verify email token.

**Request**:
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Email verified successfully",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

**Errors**:
- 401: `INVALID_TOKEN` - Token invalid or expired

---

### POST /resend
Resend verification email.

**Request**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Verification email resent"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2026-01-12T10:30:45.123Z"
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `INVALID_TOKEN` - Token format or content invalid
- `TOKEN_EXPIRED` - Token past expiration time
- `TOKEN_REVOKED` - Token has been revoked
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Not authorized for this resource
- `NOT_FOUND` - Resource doesn't exist
- `CONFLICT` - Resource already exists

---

## Rate Limiting

Response headers include:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1610425200
```

When limit exceeded (429):
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "retryAfter": 3600
}
```

---

## Pagination (Future)

When implemented:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "hasMore": true
  }
}
```

---

**Last Updated**: 12 de enero de 2026
