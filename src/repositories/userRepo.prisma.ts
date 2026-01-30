/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { Logger } from '../utils/logger';

let prismaInstance: PrismaClient;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }
  return prismaInstance;
}

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

export async function initUsersRepo(): Promise<void> {
  // Tables are created by node-pg-migrate; Prisma just uses them
  Logger.info('Users repository initialized (managed by migrations)');
}

export async function createUser(params: {
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
}): Promise<UserRow> {
  const prisma = getPrisma();
  const passwordHash = await argon2.hash(params.password);

  const user = await prisma.user.create({
    data: {
      email: params.email.toLowerCase(),
      passwordHash,
      firstName: params.firstName,
      secondName: params.secondName,
      lastName: params.lastName,
      secondLastName: params.secondLastName,
      phone: params.phone,
      nuid: params.nuid,
      birthDate: params.birthDate,
      gender: params.gender,
      nationality: params.nationality,
      birthPlace: params.birthPlace,
      placeOfResidence: params.placeOfResidence,
      occupation: params.occupation,
      maritalStatus: params.maritalStatus,
      recoveryPhone: params.recoveryPhone,
      recoveryEmail: params.recoveryEmail,
    },
  });

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    systemRole: user.systemRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    systemRole: user.systemRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserByNuid(nuid: string): Promise<UserRow | undefined> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { nuid },
  });

  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    systemRole: user.systemRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    systemRole: user.systemRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance
      .$disconnect()
      .catch((err: unknown) => Logger.error('Error closing Prisma:', err));
  }
}

/**
 * Update user information
 */
export async function updateUser(
  id: string,
  data: {
    firstName: string;
    secondName?: string | null;
    lastName: string;
    secondLastName?: string | null;
    phone: string;
    nuid: string;
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
): Promise<UserRow> {
  const prisma = getPrisma();

  const user = await prisma.user.update({
    where: { id },
    data,
  });

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    systemRole: user.systemRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Update user password
 */
export async function updateUserPassword(id: string, newPassword: string): Promise<void> {
  const prisma = getPrisma();
  const passwordHash = await argon2.hash(newPassword);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
}

/**
 * Delete user by ID
 */
export async function deleteUser(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.delete({
    where: { id },
  });
}

/**
 * List users with pagination
 */
export async function listUsers(params: {
  skip?: number;
  take?: number;
  where?: any;
}): Promise<UserRow[]> {
  const prisma = getPrisma();
  const { skip = 0, take = 10, where = {} } = params;

  const users = await prisma.user.findMany({
    skip,
    take,
    where,
  });

  return users.map((user: any) => ({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    secondName: user.secondName,
    lastName: user.lastName,
    secondLastName: user.secondLastName,
    phone: user.phone,
    nuid: user.nuid,
    userStatus: user.userStatus,
    systemRole: user.systemRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));
}

/**
 * Count users
 */
export async function countUsers(where?: any): Promise<number> {
  const prisma = getPrisma();
  return await prisma.user.count({ where });
}

/**
 * Find user by ID with addresses
 */
export async function findUserByIdWithAddresses(id: string): Promise<any> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: true,
    },
  });

  return user;
}

/**
 * Update user profile with addresses
 */
export async function updateUserProfile(
  id: string,
  data: {
    firstName?: string;
    secondName?: string | null;
    lastName?: string;
    secondLastName?: string | null;
    phone?: string;
    birthDate?: Date | null;
    gender?: string | null;
    nationality?: string | null;
    birthPlace?: string | null;
    placeOfResidence?: string | null;
    occupation?: string | null;
    maritalStatus?: string | null;
  },
  addresses?: Array<{
    country: string;
    province: string;
    city: string;
    detail: string;
    postalCode?: string;
  }>
): Promise<any> {
  const prisma = getPrisma();

  // Update user basic information
  await prisma.user.update({
    where: { id },
    data,
  });

  // Update addresses if provided
  if (addresses && addresses.length > 0) {
    // Delete existing addresses
    await prisma.address.deleteMany({
      where: { userId: id },
    });

    // Create new addresses
    await prisma.address.createMany({
      data: addresses.map((addr) => ({
        userId: id,
        country: addr.country,
        province: addr.province,
        city: addr.city,
        detail: addr.detail,
        postalCode: addr.postalCode,
      })),
    });
  }

  // Fetch updated user with addresses
  const updatedUser = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: true,
    },
  });

  return updatedUser;
}
