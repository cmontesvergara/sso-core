/**
 * Address Mapper
 * Functions to map between Prisma Address entities and DTOs
 */

import { Address as PrismaAddress } from '@prisma/client';
import { AddressResponseDTO } from '../dtos';

/**
 * Map Prisma Address to Address Response DTO
 */
export function mapAddressToResponse(address: PrismaAddress): AddressResponseDTO {
  return {
    id: address.id,
    userId: address.userId,
    country: address.country,
    province: address.province,
    city: address.city,
    detail: address.detail,
    postalCode: address.postalCode,
    createdAt: address.createdAt,
  };
}
