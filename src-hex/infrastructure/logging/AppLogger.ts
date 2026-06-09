/**
 * AppLogger
 * Logger centralizado para el IDP Core.
 * Usa console subyacente pero añade niveles, contexto y timestamps.
 * Diseñado para ser inyectado vía Container (no singleton global).
 */
export class AppLogger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private format(level: string, message: string, meta?: Record<string, any>): string {
        const ts = new Date().toISOString();
        const metaStr = meta ? ' | ' + JSON.stringify(meta) : '';
        return `[${ts}] [${level}] [${this.context}] ${message}${metaStr}`;
    }

    debug(message: string, meta?: Record<string, any>): void {
        if (process.env.LOG_LEVEL === 'debug') {
            console.log(this.format('DEBUG', message, meta));
        }
    }

    info(message: string, meta?: Record<string, any>): void {
        console.log(this.format('INFO', message, meta));
    }

    warn(message: string, meta?: Record<string, any>): void {
        console.warn(this.format('WARN', message, meta));
    }

    error(message: string, meta?: Record<string, any>): void {
        console.error(this.format('ERROR', message, meta));
    }
}
