import { v4 as uuidv4 } from 'uuid';
import { Repository } from '../database/types';
import { Role } from '../types';

/**
 * Role Service for role and permission management
 */
export class RoleService {
  private static instance: RoleService;

  private roleRepository: Repository<Role>;

  private constructor(roleRepository: Repository<Role>) {
    this.roleRepository = roleRepository;
  }

  static getInstance(roleRepository: Repository<Role>): RoleService {
    if (!RoleService.instance) {
      RoleService.instance = new RoleService(roleRepository);
    }
    return RoleService.instance;
  }

  /**
   * Create a new role
   */
  async createRole(name: string, description?: string, tenantId?: string): Promise<Role> {
    const role: Role = {
      roleId: uuidv4(),
      tenantId,
      name,
      description,
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.roleRepository.create(role);
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string): Promise<Role | null> {
    return this.roleRepository.findById(roleId);
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string, tenantId?: string): Promise<Role | null> {
    return this.roleRepository.findOne({
      name,
      ...(tenantId && { tenantId }),
    } as Partial<Role>);
  }

  /**
   * Add permission to role
   */
  async addPermissionToRole(roleId: string, permission: string): Promise<Role> {
    const role = await this.getRoleById(roleId);
    if (!role) throw new Error('Role not found');

    if (!role.permissions.includes(permission)) {
      role.permissions.push(permission);
    }

    return this.roleRepository.update(roleId, role);
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permission: string): Promise<Role> {
    const role = await this.getRoleById(roleId);
    if (!role) throw new Error('Role not found');

    role.permissions = role.permissions.filter((p) => p !== permission);

    return this.roleRepository.update(roleId, role);
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    return this.roleRepository.delete(roleId);
  }
}
