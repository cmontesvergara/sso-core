/**
 * Other Information Mapper
 * Functions to map between Prisma OtherInformation entities and DTOs
 */

import { OtherInformation as PrismaOtherInformation } from '@prisma/client';
import { OtherInformationResponseDTO } from '../dtos';

/**
 * Map Prisma OtherInformation to OtherInformation Response DTO
 */
export function mapOtherInformationToResponse(
  otherInfo: PrismaOtherInformation
): OtherInformationResponseDTO {
  return {
    id: otherInfo.id,
    userId: otherInfo.userId,
    data: otherInfo.data ?? {},
    createdAt: otherInfo.createdAt,
    updatedAt: otherInfo.updatedAt,
  };
}
