import { PrismaClient, User } from '@prisma/client';
import argon2 from 'argon2';
import { Logger } from '../../utils/logger';
import { IUserRepository } from '../interfaces/repository.interface';

/**
 * DTOs for User operations
 */
export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  secondName?: string | null;
  lastName: string;
  secondLastName?: string | null;
  phone: string;
  nuid: string;
  // Additional Information
  birthDate?: Date | null;
  gender?: string | null;
  nationality?: string | null;
  birthPlace?: string | null;
  placeOfResidence?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  // Secure Information
  recoveryPhone?: string | null;
  recoveryEmail?: string | null;
}

export interface UpdateUserDTO {
  firstName?: string;
  secondName?: string | null;
  lastName?: string;
  secondLastName?: string | null;
  phone?: string;
  nuid?: string;
  birthDate?: Date | null;
  gender?: string | null;
  nationality?: string | null;
  birthPlace?: string | null;
  placeOfResidence?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  recoveryPhone?: string | null;
  recoveryEmail?: string | null;
  userStatus?: string;
}

export interface ListUsersParams {
  skip?: number;
  take?: number;
  where?: {
    email?: string;
    nuid?: string;
    userStatus?: string;
  };
}

/**
 * UserRepository - Implementation of IUserRepository
 * Handles all user-related database operations
 */
export class UserRepository implements IUserRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new user with hashed password
   */
  async createUser(data: CreateUserDTO): Promise<User> {
    try {
      const passwordHash = await argon2.hash(data.password);

      const user = await this.prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          firstName: data.firstName,
          secondName: data.secondName,
          lastName: data.lastName,
          secondLastName: data.secondLastName,
          phone: data.phone,
          nuid: data.nuid,
          birthDate: data.birthDate,
          gender: data.gender,
          nationality: data.nationality,
          birthPlace: data.birthPlace,
          placeOfResidence: data.placeOfResidence,
          occupation: data.occupation,
          maritalStatus: data.maritalStatus,
          recoveryPhone: data.recoveryPhone,
          recoveryEmail: data.recoveryEmail,
        },
      });

      Logger.info('User created', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      Logger.error('Failed to create user', { error, email: data.email });
      throw error;
    }
  }

  /**
   * Find user by email (case-insensitive)
   */
  async findUserByEmail(email: string): Promise<User | undefined> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      return user ?? undefined;
    } catch (error) {
      Logger.error('Failed to find user by email', { error, email });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findUserById(id: string): Promise<User | undefined> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      return user ?? undefined;
    } catch (error) {
      Logger.error('Failed to find user by ID', { error, id });
      throw error;
    }
  }

  /**
   * Find user by NUID
   */
  async findUserByNuid(nuid: string): Promise<User | undefined> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { nuid },
      });

      return user ?? undefined;
    } catch (error) {
      Logger.error('Failed to find user by NUID', { error, nuid });
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(id: string, data: UpdateUserDTO): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });

      Logger.info('User updated', { userId: id });
      return user;
    } catch (error) {
      Logger.error('Failed to update user', { error, id, data });
      throw error;
    }
  }

  /**
   * Update user password with new hash
   */
  async updateUserPassword(id: string, newPassword: string): Promise<void> {
    try {
      const passwordHash = await argon2.hash(newPassword);

      await this.prisma.user.update({
        where: { id },
        data: { passwordHash },
      });

      Logger.info('User password updated', { userId: id });
    } catch (error) {
      Logger.error('Failed to update user password', { error, id });
      throw error;
    }
  }

  /**
   * Delete user by ID
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });

      Logger.info('User deleted', { userId: id });
    } catch (error) {
      Logger.error('Failed to delete user', { error, id });
      throw error;
    }
  }

  /**
   * List users with pagination and optional filters
   */
  async listUsers(params: ListUsersParams): Promise<User[]> {
    try {
      const { skip = 0, take = 10, where = {} } = params;

      const users = await this.prisma.user.findMany({
        skip,
        take,
        where: Object.keys(where).length > 0 ? where : undefined,
      });

      return users;
    } catch (error) {
      Logger.error('Failed to list users', { error, params });
      throw error;
    }
  }

  /**
   * Count users with optional filter
   */
  async countUsers(where?: { email?: string; nuid?: string; userStatus?: string }): Promise<number> {
    try {
      const prismaWhere: { email?: string; nuid?: string; userStatus?: string } = {};
      if (where?.email) prismaWhere.email = where.email;
      if (where?.nuid) prismaWhere.nuid = where.nuid;
      if (where?.userStatus) prismaWhere.userStatus = where.userStatus;

      return await this.prisma.user.count({
        where: Object.keys(prismaWhere).length > 0 ? prismaWhere : undefined,
      });
    } catch (error) {
      Logger.error('Failed to count users', { error, where });
      throw error;
    }
  }
}
