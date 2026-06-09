/**
 * ILogger
 * Puerto de salida para logging estructurado.
 * Implementado por AppLogger en la capa infrastructure.
 */
export interface ILogger {
    debug(message: string, meta?: Record<string, any>): void;
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, meta?: Record<string, any>): void;
}
