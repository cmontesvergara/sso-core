import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { Logger } from '../utils/logger';

let prismaInstance: PrismaClient;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return prismaInstance;
}

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export async function initUsersRepo(): Promise<void> {
  // Tables are created by node-pg-migrate; Prisma just uses them
  Logger.info('Users repository initialized (managed by migrations)');
}

export async function createUser(params: {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<UserRow> {
  const prisma = getPrisma();
  const { email, password, firstName, lastName } = params;

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName || '',
      lastName: lastName || '',
      secondLastName: '',
      phone: '',
    },
  });

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
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
    lastName: user.lastName,
    createdAt: user.createdAt,
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
    lastName: user.lastName,
    createdAt: user.createdAt,
  };
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance.$disconnect().catch((err: unknown) => Logger.error('Error closing Prisma:', err));
  }
}
