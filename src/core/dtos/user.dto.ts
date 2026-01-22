/**
 * User Data Transfer Objects
 */

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName?: string;
  secondName?: string;
  lastName?: string;
  secondLastName?: string;
  phone?: string;
  nuid?: string;
  birthDate?: Date;
  gender?: string;
  nationality?: string;
  birthPlace?: string;
  placeOfResidence?: string;
  occupation?: string;
  maritalStatus?: string;
  recoveryPhone?: string;
  recoveryEmail?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  secondName?: string;
  lastName?: string;
  secondLastName?: string;
  phone?: string;
  nuid?: string;
  birthDate?: Date;
  gender?: string;
  nationality?: string;
  birthPlace?: string;
  placeOfResidence?: string;
  occupation?: string;
  maritalStatus?: string;
  recoveryPhone?: string;
  recoveryEmail?: string;
  userStatus?: string;
}

export interface UserResponseDTO {
  id: string;
  email: string;
  firstName: string;
  secondName: string | null;
  lastName: string;
  secondLastName: string;
  phone: string;
  nuid: string | null;
  userStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDetailResponseDTO extends UserResponseDTO {
  birthDate: Date | null;
  gender: string | null;
  nationality: string | null;
  birthPlace: string | null;
  placeOfResidence: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  recoveryPhone: string | null;
  recoveryEmail: string | null;
}
