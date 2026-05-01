import { User } from '../../domain/entities/User';
import { UserResult } from '../dto/output/UserResult';

/**
 * UserMapper
 * Maps between User domain entity and UserResult DTO
 */
export class UserMapper {
  static toResult(user: User): UserResult {
    return {
      id: user.id.value,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      userStatus: user.userStatus,
      systemRole: user.systemRole,
      tenantMemberships: user.tenantMemberships.map((m) => ({
        tenantId: m.tenantId.value,
        tenantName: '', // Would be populated by query
        role: m.role.value,
      })),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
