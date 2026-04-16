/**
 * User Mappers
 * Functions to map between Prisma User entities and DTOs
 */

import { User as PrismaUser } from '@prisma/client';
import { UserDetailResponseDTO, UserResponseDTO } from '../dtos';

/**
 * Map Prisma User to basic User Response DTO
 */
export function mapUserToResponse(user: PrismaUser): UserResponseDTO {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Map Prisma User to detailed User Response DTO
 */
export function mapUserToDetailResponse(user: PrismaUser): UserDetailResponseDTO {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    birthDate: user.birthDate,
    gender: user.gender,
    nationality: user.nationality,
    birthPlace: user.birthPlace,
    placeOfResidence: user.placeOfResidence,
    occupation: user.occupation,
    maritalStatus: user.maritalStatus,
    recoveryPhone: user.recoveryPhone,
    recoveryEmail: user.recoveryEmail,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Exclude sensitive fields from user object
 */
export function excludeSensitiveUserFields<User extends PrismaUser, Key extends keyof User>(
  user: User,
  keys: Key[]
): Omit<User, Key> {
  const result = { ...user };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Sanitize user object by removing password hash
 */
export function sanitizeUser(user: PrismaUser): Omit<PrismaUser, 'passwordHash'> {
  return excludeSensitiveUserFields(user, ['passwordHash']);
}

/**
 * Interfaz para DTO público de usuario (sin datos sensibles)
 */
export interface UserPublicDTO {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: string;
}

/**
 * Interfaz UserRow para compatibilidad con repositories
 */
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  secondName: string | null;
  lastName: string;
  secondLastName: string | null;
  phone: string;
  nuid: string;
  userStatus: string;
  systemRole: 'super_admin' | 'system_admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mapper para transformar UserRow a DTOs seguros para exposición
 * Versión estática para uso en services sin dependencias de Prisma
 */
export class UserMapperStatic {
  /**
   * Transforma UserRow a DTO público (sin datos sensibles)
   */
  static toPublicDTO(user: UserRow): UserPublicDTO {
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      systemRole: user.systemRole,
    };
  }

  /**
   * Elimina campos sensibles de UserRow
   * @returns Objeto sin passwordHash, createdAt, updatedAt
   */
  static toSafeObject(
    user: UserRow
  ): Omit<UserRow, 'passwordHash' | 'createdAt' | 'updatedAt'> {
    const { passwordHash, createdAt, updatedAt, ...safe } = user;
    return safe;
  }

  /**
   * Verifica que el usuario tenga campos requeridos
   */
  static isValid(user: UserRow | null): user is UserRow {
    return user !== null && user.id !== undefined;
  }
}
