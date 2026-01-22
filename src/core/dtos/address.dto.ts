/**
 * Address Data Transfer Objects
 */

export interface CreateAddressDTO {
  userId: string;
  country: string;
  province: string;
  city: string;
  detail: string;
  postalCode?: string;
}

export interface UpdateAddressDTO {
  country?: string;
  province?: string;
  city?: string;
  detail?: string;
  postalCode?: string;
}

export interface AddressResponseDTO {
  id: string;
  userId: string;
  country: string;
  province: string;
  city: string;
  detail: string;
  postalCode: string | null;
  createdAt: Date;
}
