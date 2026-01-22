import { PrismaClient } from '@prisma/client';
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

export interface AddressRow {
  id: string;
  userId: string;
  country: string;
  province: string;
  city: string;
  detail: string;
  postalCode: string | null;
  createdAt: Date;
}

/**
 * Create a new address for a user
 */
export async function createAddress(data: {
  userId: string;
  country: string;
  province: string;
  city: string;
  detail: string;
  postalCode?: string | null;
}): Promise<AddressRow> {
  const prisma = getPrisma();

  const address = await prisma.address.create({
    data: {
      userId: data.userId,
      country: data.country,
      province: data.province,
      city: data.city,
      detail: data.detail,
      postalCode: data.postalCode || null,
    },
  });

  return address as AddressRow;
}

/**
 * Find addresses by user ID
 */
export async function findAddressesByUserId(userId: string): Promise<AddressRow[]> {
  const prisma = getPrisma();

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return addresses as AddressRow[];
}

/**
 * Find address by ID
 */
export async function findAddressById(id: string): Promise<AddressRow | null> {
  const prisma = getPrisma();

  const address = await prisma.address.findUnique({
    where: { id },
  });

  return address as AddressRow | null;
}

/**
 * Update an address
 */
export async function updateAddress(
  id: string,
  data: {
    country?: string;
    province?: string;
    city?: string;
    detail?: string;
    postalCode?: string | null;
  }
): Promise<AddressRow> {
  const prisma = getPrisma();

  const address = await prisma.address.update({
    where: { id },
    data,
  });

  return address as AddressRow;
}

/**
 * Delete an address
 */
export async function deleteAddress(id: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.address.delete({
    where: { id },
  });
}

export function closePrisma(): void {
  if (prismaInstance) {
    prismaInstance
      .$disconnect()
      .catch((err: unknown) => Logger.error('Error closing Prisma:', err));
  }
}
