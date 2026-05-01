/**
 * Application Layer - Casos de Uso
 *
 * Esta capa orquesta las entidades del dominio para ejecutar casos de uso específicos.
 * Depende únicamente de la capa de dominio.
 *
 * Estructura:
 * - use-cases/: Implementaciones de casos de uso
 * - ports/: Interfaces de entrada (input) y salida (output)
 * - dto/: Data Transfer Objects para entrada/salida
 * - mappers/: Conversores entre entidades y DTOs
 * - services/: Servicios de aplicación
 */

export * from './ports';
export * from './dto';
export * from './mappers';
