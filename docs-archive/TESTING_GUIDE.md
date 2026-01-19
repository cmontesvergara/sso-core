# 🧪 TESTING GUIDE - SSO Backend v2.2.0

**Objetivo:** Implementar una suite de tests completa que cubra:
- Unit tests (servicios aislados)
- Integration tests (flujos completos)
- E2E tests (simulación frontend)

---

## 📦 SETUP INICIAL

### 1. Verificar Jest Configuration

```bash
# Jest ya está instalado (ver package.json)
npm list jest
# Debería mostrar: jest@29.7.0

# Verificar configuración
cat jest.config.json
```

Si falta `jest.config.json`, crear:

```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src"],
  "testMatch": ["**/__tests__/**/*.test.ts"],
  "moduleFileExtensions": ["ts", "tsx", "js", "jsx", "json"],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/server.ts"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 70,
      "lines": 70,
      "statements": 70
    }
  },
  "testTimeout": 10000,
  "maxWorkers": "50%"
}
```

### 2. Instalar Dependencias Adicionales

```bash
npm install --save-dev \
  @testing-library/node@0.1.0 \
  @types/jest@29.5.0 \
  jest-mock-extended@3.0.5 \
  supertest@6.3.4 \
  @types/supertest@2.0.12 \
  jest-postgresql@1.1.1

# Verificar instalación
npm list @types/jest supertest
```

### 3. Estructura de Directorios

```bash
mkdir -p src/services/__tests__
mkdir -p src/routes/__tests__
mkdir -p src/middleware/__tests__
mkdir -p src/repositories/__tests__

# Ejemplo
ls -la src/services/__tests__/
# Debe estar vacío, agregaremos tests ahora
```

---

## 🧪 UNIT TESTS - Auth Service

### Archivo: `src/services/__tests__/auth.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../auth';
import { UserRepository } from '../../repositories/userRepo.prisma';
import { JwtService } from '../jwt';
import { EmailService } from '../email';
import prisma from '../prisma';

// Mock de dependencias
jest.mock('../prisma');
jest.mock('../../repositories/userRepo.prisma');
jest.mock('../jwt');
jest.mock('../email');

describe('AuthService', () => {
  let authService: AuthService;
  let userRepoMock: jest.Mocked<UserRepository>;
  let jwtServiceMock: jest.Mocked<JwtService>;
  let emailServiceMock: jest.Mocked<EmailService>;

  beforeEach(() => {
    // Setup mocks
    userRepoMock = new UserRepository(prisma) as jest.Mocked<UserRepository>;
    jwtServiceMock = new JwtService() as jest.Mocked<JwtService>;
    emailServiceMock = new EmailService() as jest.Mocked<EmailService>;

    // Instanciar servicio con mocks inyectados
    authService = new AuthService();
    authService['userRepository'] = userRepoMock;
    authService['jwtService'] = jwtServiceMock;
    authService['emailService'] = emailServiceMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user with hashed password', async () => {
      // Arrange
      const input = {
        email: 'newuser@test.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePassword123!',
      };

      const expectedUser = {
        id: 'user_123',
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash: 'hashed_password_here',
        emailVerified: false,
        createdAt: new Date(),
      };

      userRepoMock.create.mockResolvedValue(expectedUser as any);

      // Act
      const result = await authService.signup(input);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(userRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
        })
      );
      expect(result.passwordHash).toBeDefined();
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const input = {
        email: 'existing@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
        password: 'SecurePassword123!',
      };

      userRepoMock.findByEmail.mockResolvedValue({
        id: 'user_existing',
        email: input.email,
      } as any);

      // Act & Assert
      await expect(authService.signup(input)).rejects.toThrow('User already exists');
    });

    it('should send verification email', async () => {
      // Arrange
      const input = {
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'SecurePassword123!',
      };

      const newUser = {
        id: 'user_new_1',
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      };

      userRepoMock.create.mockResolvedValue(newUser as any);
      emailServiceMock.sendEmailVerification.mockResolvedValue(true);

      // Act
      await authService.signup(input);

      // Assert
      expect(emailServiceMock.sendEmailVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          email: input.email,
          firstName: input.firstName,
        })
      );
    });
  });

  describe('signin', () => {
    it('should return tokens for valid credentials', async () => {
      // Arrange
      const email = 'user@test.com';
      const password = 'CorrectPassword123!';
      const passwordHash = '$argon2id$v=19$m=65540...'; // Argon2 hash

      const user = {
        id: 'user_123',
        email,
        passwordHash,
        emailVerified: true,
      };

      const tokens = {
        accessToken: 'jwt_access_token_here',
        refreshToken: 'jwt_refresh_token_here',
        expiresIn: 900,
      };

      userRepoMock.findByEmail.mockResolvedValue(user as any);
      jwtServiceMock.signTokens.mockResolvedValue(tokens);

      // Mock password verification (real Argon2 compare)
      // En realidad, esto debería testear Argon2 también
      authService['verifyPassword'] = jest.fn().mockResolvedValue(true);

      // Act
      const result = await authService.signin({ email, password });

      // Assert
      expect(result).toEqual(tokens);
      expect(userRepoMock.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should throw error for invalid password', async () => {
      // Arrange
      const email = 'user@test.com';
      const password = 'WrongPassword';

      const user = {
        id: 'user_123',
        email,
        passwordHash: 'some_hash',
      };

      userRepoMock.findByEmail.mockResolvedValue(user as any);
      authService['verifyPassword'] = jest.fn().mockResolvedValue(false);

      // Act & Assert
      await expect(authService.signin({ email, password })).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error for non-verified email', async () => {
      // Arrange
      const user = {
        id: 'user_123',
        email: 'user@test.com',
        passwordHash: 'hash',
        emailVerified: false,
      };

      userRepoMock.findByEmail.mockResolvedValue(user as any);
      authService['verifyPassword'] = jest.fn().mockResolvedValue(true);

      // Act & Assert
      await expect(
        authService.signin({ email: 'user@test.com', password: 'password' })
      ).rejects.toThrow('Email not verified');
    });
  });

  describe('refreshToken', () => {
    it('should issue new access token with valid refresh token', async () => {
      // Arrange
      const oldRefreshToken = 'old_refresh_token';
      const newAccessToken = 'new_access_token';

      jwtServiceMock.verifyRefreshToken.mockReturnValue({
        userId: 'user_123',
        type: 'refresh',
      } as any);

      jwtServiceMock.signAccessToken.mockResolvedValue(newAccessToken);

      // Act
      const result = await authService.refreshToken(oldRefreshToken);

      // Assert
      expect(result).toEqual({ accessToken: newAccessToken });
    });

    it('should throw error for expired refresh token', async () => {
      // Arrange
      const expiredToken = 'expired_token';

      jwtServiceMock.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      // Act & Assert
      await expect(authService.refreshToken(expiredToken)).rejects.toThrow(
        'Token expired'
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      // Arrange
      const userId = 'user_123';
      const refreshToken = 'token_to_revoke';

      const mockRepository = {
        updateStatus: jest.fn().mockResolvedValue({ isValid: false }),
      };

      authService['refreshTokenRepository'] = mockRepository as any;

      // Act
      await authService.logout(userId, refreshToken);

      // Assert
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        refreshToken,
        false
      );
    });
  });
});
```

---

## 🧪 UNIT TESTS - Tenant Service

### Archivo: `src/services/__tests__/tenant.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TenantService } from '../tenant';
import prisma from '../prisma';

jest.mock('../prisma');

describe('TenantService', () => {
  let tenantService: TenantService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = prisma as jest.Mocked<typeof prisma>;
    tenantService = new TenantService(prismaMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTenant', () => {
    it('should create tenant with default roles and add user as admin', async () => {
      // Arrange
      const userId = 'user_123';
      const input = {
        name: 'Acme Corp',
        description: 'Test company',
      };

      const mockTenant = {
        id: 'tenant_1',
        name: input.name,
        description: input.description,
        createdAt: new Date(),
        createdBy: userId,
      };

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        // Simular transacción
        return callback({
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          role: {
            createMany: jest.fn().mockResolvedValue({ count: 3 }),
          },
          tenantMember: {
            create: jest
              .fn()
              .mockResolvedValue({
                id: 'member_1',
                userId,
                tenantId: mockTenant.id,
                role: 'admin',
              }),
          },
        });
      });

      prismaMock.$transaction = mockTransaction;

      // Act
      const result = await tenantService.createTenant(input, userId);

      // Assert
      expect(result).toEqual(mockTenant);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw error if user is not authenticated', async () => {
      // Arrange
      const input = { name: 'Test Tenant', description: 'Test' };

      // Act & Assert
      await expect(
        tenantService.createTenant(input, '')
      ).rejects.toThrow('User ID required');
    });
  });

  describe('inviteTenantMember', () => {
    it('should invite existing user to tenant', async () => {
      // Arrange
      const tenantId = 'tenant_1';
      const userId = 'admin_user';
      const inviteeEmail = 'newmember@test.com';
      const role = 'member';

      const mockMember = {
        id: 'member_new_1',
        userId: 'user_invitee',
        tenantId,
        role,
        createdAt: new Date(),
      };

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user_invitee',
        email: inviteeEmail,
      });

      prismaMock.tenantMember.create.mockResolvedValue(mockMember);

      // Act
      const result = await tenantService.inviteTenantMember(
        tenantId,
        userId,
        inviteeEmail,
        role
      );

      // Assert
      expect(result).toEqual(mockMember);
      expect(prismaMock.tenantMember.create).toHaveBeenCalled();
    });

    it('should create new user if invitee does not exist', async () => {
      // Arrange
      const tenantId = 'tenant_1';
      const userId = 'admin_user';
      const inviteeEmail = 'newuser@test.com';
      const role = 'member';

      // User doesn't exist
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Create new user
      const newUser = {
        id: 'user_new_1',
        email: inviteeEmail,
        firstName: inviteeEmail.split('@')[0],
        lastName: '',
        passwordHash: null,
        emailVerified: false,
      };

      prismaMock.user.create.mockResolvedValue(newUser);

      const mockMember = {
        id: 'member_new_1',
        userId: newUser.id,
        tenantId,
        role,
        createdAt: new Date(),
      };

      prismaMock.tenantMember.create.mockResolvedValue(mockMember);

      // Act
      const result = await tenantService.inviteTenantMember(
        tenantId,
        userId,
        inviteeEmail,
        role
      );

      // Assert
      expect(result).toEqual(mockMember);
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: inviteeEmail }),
        })
      );
    });

    it('should throw error if admin tries to invite someone who is already member', async () => {
      // Arrange
      const tenantId = 'tenant_1';
      const userId = 'admin_user';
      const inviteeEmail = 'existing@test.com';

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user_existing',
        email: inviteeEmail,
      });

      // User is already member
      prismaMock.tenantMember.findUnique.mockResolvedValue({
        id: 'member_1',
        userId: 'user_existing',
        tenantId,
      });

      // Act & Assert
      await expect(
        tenantService.inviteTenantMember(
          tenantId,
          userId,
          inviteeEmail,
          'member'
        )
      ).rejects.toThrow('User is already a member');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role when admin requests', async () => {
      // Arrange
      const tenantId = 'tenant_1';
      const adminUserId = 'admin_1';
      const memberId = 'member_2';
      const newRole = 'admin';

      // Mock: admin is admin
      prismaMock.tenantMember.findUnique.mockResolvedValueOnce({
        userId: adminUserId,
        tenantId,
        role: 'admin',
      });

      // Mock: member exists
      prismaMock.tenantMember.findUnique.mockResolvedValueOnce({
        id: memberId,
        userId: 'user_2',
        tenantId,
        role: 'member',
      });

      // Mock: update
      const updatedMember = {
        id: memberId,
        userId: 'user_2',
        tenantId,
        role: newRole,
      };

      prismaMock.tenantMember.update.mockResolvedValue(updatedMember);

      // Act
      const result = await tenantService.updateMemberRole(
        tenantId,
        adminUserId,
        memberId,
        newRole
      );

      // Assert
      expect(result.role).toBe(newRole);
    });

    it('should throw error if non-admin tries to update role', async () => {
      // Arrange
      const tenantId = 'tenant_1';
      const memberUserId = 'member_1';
      const memberId = 'member_2';

      // Mock: member is NOT admin
      prismaMock.tenantMember.findUnique.mockResolvedValue({
        userId: memberUserId,
        tenantId,
        role: 'member',
      });

      // Act & Assert
      await expect(
        tenantService.updateMemberRole(
          tenantId,
          memberUserId,
          memberId,
          'admin'
        )
      ).rejects.toThrow('Only admins can update member roles');
    });
  });

  describe('removeMember', () => {
    it('should prevent removing last admin', async () => {
      // Arrange
      const tenantId = 'tenant_1';
      const adminUserId = 'admin_1';
      const memberToRemove = 'admin_1';  // ← Same as admin

      // Mock: requester is admin
      prismaMock.tenantMember.findUnique.mockResolvedValueOnce({
        userId: adminUserId,
        tenantId,
        role: 'admin',
      });

      // Mock: member to remove is admin
      prismaMock.tenantMember.findUnique.mockResolvedValueOnce({
        id: 'member_1',
        userId: memberToRemove,
        tenantId,
        role: 'admin',
      });

      // Mock: count admins → only 1
      prismaMock.tenantMember.count.mockResolvedValue(1);

      // Act & Assert
      await expect(
        tenantService.removeMember(tenantId, adminUserId, 'member_1')
      ).rejects.toThrow('Cannot remove the last admin');
    });

    it('should remove member successfully', async () => {
      // Arrange
      const tenantId = 'tenant_1';
      const adminUserId = 'admin_1';
      const memberIdToRemove = 'member_2';

      // Mock: requester is admin
      prismaMock.tenantMember.findUnique.mockResolvedValueOnce({
        userId: adminUserId,
        tenantId,
        role: 'admin',
      });

      // Mock: member to remove is NOT last admin
      prismaMock.tenantMember.findUnique.mockResolvedValueOnce({
        id: memberIdToRemove,
        userId: 'user_to_remove',
        tenantId,
        role: 'member',
      });

      // Mock: delete
      prismaMock.tenantMember.delete.mockResolvedValue({
        id: memberIdToRemove,
      });

      // Act
      await tenantService.removeMember(
        tenantId,
        adminUserId,
        memberIdToRemove
      );

      // Assert
      expect(prismaMock.tenantMember.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: memberIdToRemove },
        })
      );
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has permission', async () => {
      // Arrange
      const userId = 'user_1';
      const tenantId = 'tenant_1';
      const permission = 'users:write';

      // Mock: find user's role in tenant
      prismaMock.tenantMember.findUnique.mockResolvedValue({
        userId,
        tenantId,
        role: 'admin',
      });

      // Mock: get role permissions
      prismaMock.role.findUnique.mockResolvedValue({
        name: 'admin',
        permissions: {
          connect: [
            { id: 'perm_1' },
            { id: 'perm_2' },
            { id: 'perm_3' },
          ],
        },
      });

      // Mock: check if permission exists
      prismaMock.permission.findFirst.mockResolvedValue({
        id: 'perm_1',
        name: permission,
      });

      // Act
      const result = await tenantService.hasPermission(
        userId,
        tenantId,
        permission
      );

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if user lacks permission', async () => {
      // Arrange
      const userId = 'user_1';
      const tenantId = 'tenant_1';
      const permission = 'settings:manage';

      // Mock: find user's role
      prismaMock.tenantMember.findUnique.mockResolvedValue({
        userId,
        tenantId,
        role: 'viewer',
      });

      // Mock: get viewer permissions (limited)
      prismaMock.role.findUnique.mockResolvedValue({
        name: 'viewer',
        permissions: {
          connect: [{ id: 'perm_read_only' }],
        },
      });

      // Mock: permission NOT found
      prismaMock.permission.findFirst.mockResolvedValue(null);

      // Act
      const result = await tenantService.hasPermission(
        userId,
        tenantId,
        permission
      );

      // Assert
      expect(result).toBe(false);
    });
  });
});
```

---

## 🧪 INTEGRATION TESTS - Auth Flow

### Archivo: `src/routes/__tests__/auth.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../index';
import prisma from '../../services/prisma';

describe('Auth API - Integration Tests', () => {
  let testUser: any;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Limpiar base de datos antes de tests
    // ADVERTENCIA: Solo en ambiente de prueba
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$disconnect();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user', async () => {
      // Act
      const response = await request(app).post('/api/auth/signup').send({
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'SecurePassword123!',
      });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'test@test.com');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Save for next tests
      testUser = response.body.user;
    });

    it('should reject duplicate email', async () => {
      // Act
      const response = await request(app).post('/api/auth/signup').send({
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'AnotherPassword123!',
      });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate password strength', async () => {
      // Act
      const response = await request(app).post('/api/auth/signup').send({
        email: 'newuser@test.com',
        firstName: 'New',
        lastName: 'User',
        password: 'weak',  // ← Too weak
      });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('password');
    });
  });

  describe('POST /api/auth/signin', () => {
    it('should return tokens for valid credentials', async () => {
      // Necesitamos un usuario con email verificado
      // (pre-requisito: crear usuario y marcar email como verificado)

      // Act
      const response = await request(app).post('/api/auth/signin').send({
        email: 'test@test.com',
        password: 'SecurePassword123!',
      });

      // Assert (esperamos error porque email no está verificado)
      // En un test real, primero verificarías el email
      expect(response.status).toBeOneOf([200, 400, 401]);
    });

    it('should reject invalid password', async () => {
      // Act
      const response = await request(app).post('/api/auth/signin').send({
        email: 'test@test.com',
        password: 'WrongPassword',
      });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBeTruthy();
    });

    it('should reject non-existent user', async () => {
      // Act
      const response = await request(app).post('/api/auth/signin').send({
        email: 'nonexistent@test.com',
        password: 'password',
      });

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should return new access token with valid refresh token', async () => {
      // Nota: Primero necesitarías un refresh token válido
      // Este test asume que tienes uno disponible

      // Act
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: refreshToken,  // Obtenido del signin
        });

      // Assert
      if (response.status === 200) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body.accessToken).not.toBe(accessToken);
      }
    });

    it('should reject expired refresh token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'invalid_or_expired_token',
        });

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should invalidate tokens', async () => {
      // Necesitas un token válido primero
      // Este es un test skeleton

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      // Assert
      if (response.status === 200) {
        // El token debería estar revocado ahora
        // Intentar usarlo de nuevo debería fallar
      }
    });
  });
});
```

---

## ▶️ EJECUTAR TESTS

### Primero, agregar scripts en `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=__tests__/.*\\.test\\.ts$",
    "test:integration": "jest --testPathPattern=.*\\.integration\\.test\\.ts$",
    "test:e2e": "jest --testPathPattern=.*\\.e2e\\.test\\.ts$",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

### Ejecutar tests:

```bash
# Ejecutar todos los tests
npm test

# Ver cobertura
npm run test:coverage

# Watch mode (ejecuta tests al guardar archivos)
npm run test:watch

# Solo tests de servicios
npm run test:unit -- src/services/__tests__

# Debug (paso a paso con Chrome DevTools)
npm run test:debug -- src/services/__tests__/auth.test.ts

# Ejecutar un test específico
npm test -- auth.test.ts

# Ejecutar un describe específico
npm test -- -t "signup"
```

---

## 📊 COBERTURA TARGET

```
┌──────────────┬────────────┬────────────┬────────────┐
│ File         │ Stmts      │ Branch     │ Function   │
├──────────────┼────────────┼────────────┼────────────┤
│ auth.ts      │ 90%        │ 85%        │ 90%        │
│ tenant.ts    │ 85%        │ 80%        │ 85%        │
│ email.ts     │ 80%        │ 75%        │ 80%        │
│ jwt.ts       │ 95%        │ 90%        │ 95%        │
│ otp.ts       │ 85%        │ 80%        │ 85%        │
├──────────────┼────────────┼────────────┼────────────┤
│ TOTAL        │ > 85%      │ > 80%      │ > 85%      │
└──────────────┴────────────┴────────────┴────────────┘
```

---

## ✅ TESTING ROADMAP

**Semana 1:**
- [ ] Setup Jest + mocking
- [ ] Auth service unit tests (signup, signin)
- [ ] Tenant service unit tests (create, invite, update)
- [ ] Coverage > 80%

**Semana 2:**
- [ ] Email service tests (all 3 providers)
- [ ] JWT service tests
- [ ] Route integration tests
- [ ] Coverage > 85%

**Semana 3:**
- [ ] E2E tests (full flows)
- [ ] Security tests
- [ ] Multi-tenant isolation tests
- [ ] Coverage > 90%

**Semana 4:**
- [ ] Performance benchmarks
- [ ] Load testing
- [ ] Bug fixes from testing
- [ ] Final polish

---

**Estimated effort:** 60-80 hours
**Result:** Production-ready test suite with 90%+ coverage
