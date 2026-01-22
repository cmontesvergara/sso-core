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
