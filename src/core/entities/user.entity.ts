/**
 * User Entity - Based on Prisma Schema
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  secondName: string | null;
  lastName: string;
  secondLastName: string;
  phone: string;
  nuid: string | null;

  // Additional Information
  birthDate: Date | null;
  gender: string | null;
  nationality: string | null;
  birthPlace: string | null;
  placeOfResidence: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  userStatus: string;

  // Secure Information
  passwordHash: string;
  recoveryPhone: string | null;
  recoveryEmail: string | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBasicInfo {
  id: string;
  email: string;
  firstName: string;
  secondName: string | null;
  lastName: string;
  secondLastName: string;
  phone: string;
  userStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  userId: string;
  country: string;
  province: string;
  city: string;
  detail: string;
  postalCode: string | null;
  createdAt: Date;
}

export interface OtherInformation {
  id: string;
  userId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
