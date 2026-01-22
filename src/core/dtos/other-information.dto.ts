/**
 * Other Information Data Transfer Objects
 */

import { Prisma } from '@prisma/client';

export interface CreateOtherInformationDTO {
  userId: string;
  data: Prisma.InputJsonValue;
}

export interface UpdateOtherInformationDTO {
  data: Prisma.InputJsonValue;
}

export interface OtherInformationResponseDTO {
  id: string;
  userId: string;
  data: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}
