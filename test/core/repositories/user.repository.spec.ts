/**
 * Tests para UserRepository
 * Cubre: createUser, findUserByEmail, findUserById, findUserByNuid,
 * updateUser, updateUserPassword, deleteUser, listUsers, countUsers
 */

import { UserRepository, CreateUserDTO, UpdateUserDTO } from '../../../src/core/repositories/user.repository';

// Mock del cliente Prisma
const mockPrismaClient: any = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

// Mock de argon2
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
}));

// Mock de Prisma
jest.mock('../../../src/services/prisma', () => ({
  getPrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock de Logger
jest.mock('../../../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('UserRepository', () => {
  let repository: UserRepository;
  const argon2 = require('argon2');

  beforeEach(() => {
    jest.clearAllMocks();

    // Resetear mocks del cliente Prisma
    Object.keys(mockPrismaClient.user).forEach((key) => {
      (mockPrismaClient.user[key] as jest.Mock).mockClear();
    });

    // Resetear mock de argon2
    (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    repository = new UserRepository(mockPrismaClient);
  });

  describe('createUser', () => {
    it('debe crear un usuario exitosamente con password hasheado', async () => {
      // Arrange
      const dto: CreateUserDTO = {
        email: 'user@test.com',
        password: 'secret123',
        firstName: 'Test',
        lastName: 'User',
        phone: '123456789',
        nuid: '123456789',
      };

      const mockUser = {
        id: '1',
        email: dto.email.toLowerCase(),
        passwordHash: 'hashed-password',
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        nuid: dto.nuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await repository.createUser(dto);

      // Assert
      expect(argon2.hash).toHaveBeenCalledWith('secret123');
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'user@test.com',
          passwordHash: 'hashed-password',
          firstName: 'Test',
          lastName: 'User',
        }),
      });
      expect(result).toEqual(mockUser);
    });

    it('debe convertir email a minúsculas', async () => {
      // Arrange
      const dto: CreateUserDTO = {
        email: 'USER@TEST.COM',
        password: 'secret123',
        firstName: 'Test',
        lastName: 'User',
        phone: '123456789',
        nuid: '123456789',
      };

      const mockUser = { id: '1', email: 'user@test.com' };

      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await repository.createUser(dto);

      // Assert
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'user@test.com',
        }),
      });
    });

    it('debe crear usuario con campos opcionales', async () => {
      // Arrange
      const dto: CreateUserDTO = {
        email: 'user@test.com',
        password: 'secret123',
        firstName: 'Test',
        secondName: 'Middle',
        lastName: 'User',
        secondLastName: 'Second',
        phone: '123456789',
        nuid: '123456789',
        birthDate: new Date('2000-01-01'),
        gender: 'M',
        nationality: 'US',
        occupation: 'Developer',
      };

      const mockUser = { id: '1', ...dto, email: dto.email.toLowerCase(), password: undefined };

      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await repository.createUser(dto);

      // Assert
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          secondName: 'Middle',
          secondLastName: 'Second',
          birthDate: new Date('2000-01-01'),
          gender: 'M',
          nationality: 'US',
          occupation: 'Developer',
        }),
      });
    });
  });

  describe('findUserByEmail', () => {
    it('debe encontrar usuario por email', async () => {
      // Arrange
      const mockUser = { id: '1', email: 'user@test.com', firstName: 'Test' };

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await repository.findUserByEmail('user@test.com');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('debe convertir email a minúsculas para la búsqueda', async () => {
      // Arrange
      const mockUser = { id: '1', email: 'user@test.com' };

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await repository.findUserByEmail('USER@TEST.COM');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
    });

    it('debe retornar undefined si usuario no existe', async () => {
      // Arrange
      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findUserByEmail('notfound@test.com');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findUserById', () => {
    it('debe encontrar usuario por ID', async () => {
      // Arrange
      const mockUser = { id: '1', email: 'user@test.com' };

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await repository.findUserById('1');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toEqual(mockUser);
    });

    it('debe retornar undefined si usuario no existe', async () => {
      // Arrange
      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findUserById('999');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findUserByNuid', () => {
    it('debe encontrar usuario por NUID', async () => {
      // Arrange
      const mockUser = { id: '1', nuid: '123456789', email: 'user@test.com' };

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await repository.findUserByNuid('123456789');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { nuid: '123456789' },
      });
      expect(result).toEqual(mockUser);
    });

    it('debe retornar undefined si usuario no existe', async () => {
      // Arrange
      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await repository.findUserByNuid('999999999');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('updateUser', () => {
    it('debe actualizar usuario', async () => {
      // Arrange
      const data: UpdateUserDTO = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const mockUser = { id: '1', email: 'user@test.com', ...data };

      (mockPrismaClient.user.update as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await repository.updateUser('1', data);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data,
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUserPassword', () => {
    it('debe actualizar password del usuario', async () => {
      // Arrange
      const newPassword = 'newSecret123';

      // Act
      await repository.updateUserPassword('1', newPassword);

      // Assert
      expect(argon2.hash).toHaveBeenCalledWith('newSecret123');
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { passwordHash: 'hashed-password' },
      });
    });
  });

  describe('deleteUser', () => {
    it('debe eliminar usuario por ID', async () => {
      // Arrange
      (mockPrismaClient.user.delete as jest.Mock).mockResolvedValue({});

      // Act
      await repository.deleteUser('1');

      // Assert
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('listUsers', () => {
    it('debe listar usuarios con paginación por defecto', async () => {
      // Arrange
      const mockUsers = [
        { id: '1', email: 'user1@test.com' },
        { id: '2', email: 'user2@test.com' },
      ];

      (mockPrismaClient.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      // Act
      const result = await repository.listUsers({});

      // Assert
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: undefined,
      });
      expect(result).toEqual(mockUsers);
    });

    it('debe listar usuarios con filtros personalizados', async () => {
      // Arrange
      const mockUsers = [{ id: '1', email: 'user@test.com' }];

      (mockPrismaClient.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      // Act
      const result = await repository.listUsers({
        skip: 20,
        take: 5,
        where: { email: 'user@test.com', userStatus: 'active' },
      });

      // Assert
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 5,
        where: { email: 'user@test.com', userStatus: 'active' },
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('countUsers', () => {
    it('debe contar todos los usuarios', async () => {
      // Arrange
      (mockPrismaClient.user.count as jest.Mock).mockResolvedValue(100);

      // Act
      const result = await repository.countUsers();

      // Assert
      expect(mockPrismaClient.user.count).toHaveBeenCalledWith({
        where: undefined,
      });
      expect(result).toBe(100);
    });

    it('debe contar usuarios con filtros', async () => {
      // Arrange
      (mockPrismaClient.user.count as jest.Mock).mockResolvedValue(50);

      // Act
      const result = await repository.countUsers({
        email: 'test@test.com',
        nuid: '123456789',
        userStatus: 'active',
      });

      // Assert
      expect(mockPrismaClient.user.count).toHaveBeenCalledWith({
        where: {
          email: 'test@test.com',
          nuid: '123456789',
          userStatus: 'active',
        },
      });
      expect(result).toBe(50);
    });
  });
});
