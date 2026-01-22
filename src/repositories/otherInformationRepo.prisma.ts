import { Prisma, PrismaClient } from '@prisma/client';
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

export interface OtherInformationRow {
  id: string;
  userId: string;
  data: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create other information for a user
 */
export async function createOtherInformation(data: {
  userId: string;
  data: Prisma.InputJsonValue;
}): Promise<OtherInformationRow> {
  const prisma = getPrisma();

  const otherInfo = await prisma.otherInformation.create({
    data: {
      userId: data.userId,
      data: data.data,
    },
  });

  return otherInfo as OtherInformationRow;
}

/**
 * Find other information by user ID
 */
export async function findOtherInformationByUserId(
  userId: string
): Promise<OtherInformationRow | null> {
  const prisma = getPrisma();

  const otherInfo = await prisma.otherInformation.findUnique({
    where: { userId },
  });

  return otherInfo as OtherInformationRow | null;
}

/**
 * Update other information
 */
export async function updateOtherInformation(
  userId: string,
  data: Prisma.InputJsonValue
): Promise<OtherInformationRow> {
  const prisma = getPrisma();

  const otherInfo = await prisma.otherInformation.upsert({
    where: { userId },
    create: {
      userId,
      data,
    },
    update: {
      data,
    },
  });

  return otherInfo as OtherInformationRow;
}

/**
 * Delete other information
 */
export async function deleteOtherInformation(userId: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.otherInformation.delete({
    where: { userId },
  });
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance
      .$disconnect()
      .catch((err: unknown) => Logger.error('Error closing Prisma:', err));
  }
}
