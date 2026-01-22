/**
 * Core Module Barrel Export
 * Central export point for all core functionality
 *
 * Structure:
 * - entities/    → Domain entities (User, Address, Tenant, etc.)
 * - dtos/        → Data Transfer Objects for API requests/responses
 * - interfaces/  → Interface contracts for services and repositories
 * - mappers/     → Entity to DTO mapping functions
 * - schemas/     → Joi validation schemas
 */

// Export all entities
export * from './entities';

// Export all DTOs
export * from './dtos';

// Export all interfaces
export * from './interfaces';

// Export all mappers
export * from './mappers';

// Export all validation schemas
export * from './schemas';
