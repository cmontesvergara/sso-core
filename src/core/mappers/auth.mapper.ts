/**
 * Auth Mappers
 * Functions to map between Prisma Auth entities and DTOs
 */

import { EmailVerification as PrismaEmailVerification } from '@prisma/client';
import { EmailVerificationResponseDTO } from '../dtos';

/**
 * Map Prisma EmailVerification to EmailVerification Response DTO
 */
export function mapEmailVerificationToResponse(
  emailVerification: PrismaEmailVerification
): EmailVerificationResponseDTO {
  return {
    id: emailVerification.id,
    userId: emailVerification.userId,
    email: emailVerification.email,
    verified: emailVerification.verified,
    expiresAt: emailVerification.expiresAt,
    createdAt: emailVerification.createdAt,
  };
}
