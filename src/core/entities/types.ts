/**
 * Entity Type Definitions
 * Enums and type aliases for entities
 */

// User Types
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'other';

// Tenant Types
export type TenantRole = 'owner' | 'admin' | 'member' | 'guest';

// Permission Types
export type ResourceType = 'user' | 'tenant' | 'role' | 'permission' | 'settings';
export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'manage';
