import { Email } from '../value-objects/Email';
import { NUID } from '../value-objects/NUID';
import { PasswordHash } from '../value-objects/PasswordHash';
import { RoleName } from '../value-objects/RoleName';
import { TenantId } from '../value-objects/TenantId';
import { UserId } from '../value-objects/UserId';

/**
 * UserStatus
 * Possible states of a user account
 * Matches Prisma: user_status String @default("disabled")
 */
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended' | 'disabled';


/**
 * Address
 * Embedded value object for user addresses
 * Matches Prisma Address model
 */
export interface Address {
  id?: string;
  country: string;
  province: string;
  city: string;
  detail: string;
  postalCode?: string;
  createdAt?: Date;
}

/**
 * UserTenantMembership
 * Relationship between user and tenant
 * Matches Prisma: tenant_members table
 */
export interface UserTenantMembership {
  tenantId: TenantId;
  role: RoleName;
  joinedAt: Date;
}

/**
 * User Entity
 * Core domain entity representing a user in the system
 * Aligned with Prisma schema
 * Immutable - changes create new instances
 */
export class User {
  constructor(
    private readonly _id: UserId,
    private readonly _email: Email,
    private readonly _nuid: NUID,
    private readonly _firstName: string,
    private readonly _lastName: string,
    private readonly _passwordHash: PasswordHash,
    private readonly _userStatus: UserStatus,
    private readonly _systemRole: string = 'user',
    // Required fields from Prisma
    private readonly _phone: string,
    // Optional profile fields
    private readonly _secondName: string | null,
    private readonly _secondLastName: string | null,
    private readonly _birthDate: Date | null,
    private readonly _gender: string | null,
    private readonly _nationality: string | null,
    private readonly _birthPlace: string | null,
    private readonly _placeOfResidence: string | null,
    private readonly _occupation: string | null,
    private readonly _maritalStatus: string | null,
    // Recovery information
    private readonly _recoveryPhone: string | null,
    private readonly _recoveryEmail: string | null,
    // Relations
    private readonly _addresses: Address[],
    private readonly _tenantMemberships: UserTenantMembership[],
    // Metadata
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date,
    private readonly _lastLoginAt?: Date
  ) {
    Object.freeze(this);
    Object.freeze(this._addresses);
    Object.freeze(this._tenantMemberships);
  }

  // Getters
  get id(): UserId {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get nuid(): NUID {
    return this._nuid;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get fullName(): string {
    return `${this._firstName} ${this._lastName}`.trim();
  }

  get passwordHash(): PasswordHash {
    return this._passwordHash;
  }

  get userStatus(): UserStatus {
    return this._userStatus;
  }


  get phone(): string {
    return this._phone;
  }

  get systemRole(): string {
    return this._systemRole;
  }

  // Optional fields getters
  get secondName(): string | null {
    return this._secondName;
  }

  get secondLastName(): string | null {
    return this._secondLastName;
  }

  get birthDate(): Date | null {
    return this._birthDate ? new Date(this._birthDate) : null;
  }

  get gender(): string | null {
    return this._gender;
  }

  get nationality(): string | null {
    return this._nationality;
  }

  get birthPlace(): string | null {
    return this._birthPlace;
  }

  get placeOfResidence(): string | null {
    return this._placeOfResidence;
  }

  get occupation(): string | null {
    return this._occupation;
  }

  get maritalStatus(): string | null {
    return this._maritalStatus;
  }

  get recoveryPhone(): string | null {
    return this._recoveryPhone;
  }

  get recoveryEmail(): string | null {
    return this._recoveryEmail;
  }

  // Relations
  get addresses(): ReadonlyArray<Address> {
    return this._addresses;
  }

  get tenantMemberships(): ReadonlyArray<UserTenantMembership> {
    return this._tenantMemberships;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  get lastLoginAt(): Date | undefined {
    return this._lastLoginAt ? new Date(this._lastLoginAt) : undefined;
  }

  /**
   * Check if user is active
   */
  isActive(): boolean {
    return this._userStatus === 'active';
  }

  /**
   * Check if user can access a specific tenant
   */
  canAccessTenant(tenantId: TenantId): boolean {
    return this._tenantMemberships.some((m) => m.tenantId.value === tenantId.value);
  }

  /**
   * Get user's role in a specific tenant
   */
  getRoleForTenant(tenantId: TenantId): RoleName | null {
    const membership = this._tenantMemberships.find((m) => m.tenantId.value === tenantId.value);
    return membership?.role ?? null;
  }

  /**
   * Check if user has a specific permission (simplified check)
   */
  hasPermission(_permission: string): boolean {
    // Add more permission logic as needed
    return false;
  }

  /**
   * Returns a new User with the given tenant membership added.
   * If the user already has a membership for this tenant, the old one is replaced
   * (role change). This keeps the membership list free of duplicates.
   */
  withTenantMembership(membership: UserTenantMembership): User {
    const filtered = this._tenantMemberships.filter(
      (m) => m.tenantId.value !== membership.tenantId.value
    );
    return new User(
      this._id,
      this._email,
      this._nuid,
      this._firstName,
      this._lastName,
      this._passwordHash,
      this._userStatus,
      this._systemRole,
      this._phone,
      this._secondName,
      this._secondLastName,
      this._birthDate,
      this._gender,
      this._nationality,
      this._birthPlace,
      this._placeOfResidence,
      this._occupation,
      this._maritalStatus,
      this._recoveryPhone,
      this._recoveryEmail,
      this._addresses,
      [...filtered, membership],
      this._createdAt,
      new Date(),
      this._lastLoginAt
    );
  }

  /**
   * Returns a new User with the membership for the given tenant removed.
   */
  withoutTenantMembership(tenantId: TenantId): User {
    return new User(
      this._id,
      this._email,
      this._nuid,
      this._firstName,
      this._lastName,
      this._passwordHash,
      this._userStatus,
      this._systemRole,
      this._phone,
      this._secondName,
      this._secondLastName,
      this._birthDate,
      this._gender,
      this._nationality,
      this._birthPlace,
      this._placeOfResidence,
      this._occupation,
      this._maritalStatus,
      this._recoveryPhone,
      this._recoveryEmail,
      this._addresses,
      this._tenantMemberships.filter((m) => m.tenantId.value !== tenantId.value),
      this._createdAt,
      new Date(),
      this._lastLoginAt
    );
  }

  /**
   * Create a new User with updated profile fields.
   * All fields are optional — only provided ones are replaced.
   */
  withProfile(patch: {
    firstName?: string;
    lastName?: string;
    secondName?: string | null;
    secondLastName?: string | null;
    phone?: string;
    birthDate?: Date | null;
    gender?: string | null;
    nationality?: string | null;
    birthPlace?: string | null;
    placeOfResidence?: string | null;
    occupation?: string | null;
    maritalStatus?: string | null;
    recoveryPhone?: string | null;
    recoveryEmail?: string | null;
  }): User {
    return new User(
      this._id,
      this._email,
      this._nuid,
      patch.firstName ?? this._firstName,
      patch.lastName ?? this._lastName,
      this._passwordHash,
      this._userStatus,
      this._systemRole,
      patch.phone ?? this._phone,
      patch.secondName !== undefined ? patch.secondName : this._secondName,
      patch.secondLastName !== undefined ? patch.secondLastName : this._secondLastName,
      patch.birthDate !== undefined ? patch.birthDate : this._birthDate,
      patch.gender !== undefined ? patch.gender : this._gender,
      patch.nationality !== undefined ? patch.nationality : this._nationality,
      patch.birthPlace !== undefined ? patch.birthPlace : this._birthPlace,
      patch.placeOfResidence !== undefined ? patch.placeOfResidence : this._placeOfResidence,
      patch.occupation !== undefined ? patch.occupation : this._occupation,
      patch.maritalStatus !== undefined ? patch.maritalStatus : this._maritalStatus,
      patch.recoveryPhone !== undefined ? patch.recoveryPhone : this._recoveryPhone,
      patch.recoveryEmail !== undefined ? patch.recoveryEmail : this._recoveryEmail,
      this._addresses,
      this._tenantMemberships,
      this._createdAt,
      new Date(),
      this._lastLoginAt
    );
  }

  /**
   * Create a new user with updated last login
   */
  withLastLogin(now: Date = new Date()): User {
    return new User(
      this._id,
      this._email,
      this._nuid,
      this._firstName,
      this._lastName,
      this._passwordHash,
      this._userStatus,
      this._systemRole,
      this._phone,
      this._secondName,
      this._secondLastName,
      this._birthDate,
      this._gender,
      this._nationality,
      this._birthPlace,
      this._placeOfResidence,
      this._occupation,
      this._maritalStatus,
      this._recoveryPhone,
      this._recoveryEmail,
      this._addresses,
      this._tenantMemberships,
      this._createdAt,
      this._updatedAt,
      now
    );
  }

  /**
   * Create a new user with updated status
   */
  withStatus(newStatus: UserStatus): User {
    return new User(
      this._id,
      this._email,
      this._nuid,
      this._firstName,
      this._lastName,
      this._passwordHash,
      newStatus,
      this._systemRole,
      this._phone,
      this._secondName,
      this._secondLastName,
      this._birthDate,
      this._gender,
      this._nationality,
      this._birthPlace,
      this._placeOfResidence,
      this._occupation,
      this._maritalStatus,
      this._recoveryPhone,
      this._recoveryEmail,
      this._addresses,
      this._tenantMemberships,
      this._createdAt,
      new Date(),
      this._lastLoginAt
    );
  }

  /**
   * Create a new user with new password hash
   */
  withPasswordHash(newPasswordHash: PasswordHash): User {
    return new User(
      this._id,
      this._email,
      this._nuid,
      this._firstName,
      this._lastName,
      newPasswordHash,
      this._userStatus,
      this._systemRole,
      this._phone,
      this._secondName,
      this._secondLastName,
      this._birthDate,
      this._gender,
      this._nationality,
      this._birthPlace,
      this._placeOfResidence,
      this._occupation,
      this._maritalStatus,
      this._recoveryPhone,
      this._recoveryEmail,
      this._addresses,
      this._tenantMemberships,
      this._createdAt,
      new Date(),
      this._lastLoginAt
    );
  }

  /**
   * Create a new user with additional address
   */
  withAddress(address: Address): User {
    return new User(
      this._id,
      this._email,
      this._nuid,
      this._firstName,
      this._lastName,
      this._passwordHash,
      this._userStatus,
      this._systemRole,
      this._phone,
      this._secondName,
      this._secondLastName,
      this._birthDate,
      this._gender,
      this._nationality,
      this._birthPlace,
      this._placeOfResidence,
      this._occupation,
      this._maritalStatus,
      this._recoveryPhone,
      this._recoveryEmail,
      [...this._addresses, address],
      this._tenantMemberships,
      this._createdAt,
      new Date(),
      this._lastLoginAt
    );
  }
}
