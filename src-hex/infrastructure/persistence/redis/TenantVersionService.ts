import Redis from 'ioredis';

// TTL del contador de versión: 30 días (se refresca en cada acceso)
const VERSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * TenantVersionService
 *
 * Implementa el patrón de "tagging por versión" para invalidar grupos de
 * keys de Redis sin usar SCAN ni borrar keys individuales.
 *
 * Cada tenant tiene un contador entero en Redis. Las keys de cache que
 * dependen de configuración de tenant incluyen :v{N} como sufijo.
 * Al incrementar el contador, todas las keys del grupo antiguo se convierten
 * en "fantasmas" — el TTL las recoge automáticamente.
 *
 * Invalidación O(1):  incrVersion(tenantId)  → INCR atómico, sin locks.
 * Sin SCAN, sin DEL en loop, sin riesgo de inconsistencia.
 *
 * Aggregates que usan versión de tenant:
 *   - role          (roles son config del tenant)
 *   - permission    (permisos son config del tenant)
 *
 * Aggregates con v0 fijo (no dependen de config de tenant):
 *   - user, session, refresh-token, auth-code, email-verif, otp, app
 */
export class TenantVersionService {
  constructor(private readonly redis: Redis) {}

  /**
   * Retorna la versión actual del tenant.
   * Si no existe, inicializa en 1 (SET NX) y retorna 1.
   */
  async getVersion(tenantId: string): Promise<number> {
    const key = this.versionKey(tenantId);
    const raw = await this.redis.get(key);
    if (raw !== null) {
      // Refresh TTL on read so hot tenants never expire
      await this.redis.expire(key, VERSION_TTL_SECONDS);
      return parseInt(raw, 10);
    }
    // Initialize to 1
    await this.redis.set(key, '1', 'EX', VERSION_TTL_SECONDS);
    return 1;
  }

  /**
   * Incrementa la versión de un tenant de forma atómica (INCR).
   * Retorna la nueva versión.
   *
   * Llamar cuando:
   *   - Se cambia un rol en el tenant
   *   - Se cambian permisos de un rol
   *   - Se añade / quita un miembro del tenant
   *   - Se actualiza configuración del tenant
   */
  async incrVersion(tenantId: string): Promise<number> {
    const key = this.versionKey(tenantId);
    const newVersion = await this.redis.incr(key);
    // Re-set TTL after INCR (INCR doesn't reset TTL)
    await this.redis.expire(key, VERSION_TTL_SECONDS);
    return newVersion;
  }

  /**
   * Fuerza la versión a un valor específico.
   * Uso principal: tests y herramientas administrativas.
   */
  async setVersion(tenantId: string, version: number): Promise<void> {
    await this.redis.set(this.versionKey(tenantId), String(version), 'EX', VERSION_TTL_SECONDS);
  }

  /**
   * Resetea la versión a 1. Útil en tests.
   */
  async resetVersion(tenantId: string): Promise<void> {
    await this.setVersion(tenantId, 1);
  }

  /**
   * Key del contador — no incluye :vN para evitar recursión.
   * Patrón: {prefix}:iam:tenant:version:{tenantId}
   */
  versionKey(tenantId: string): string {
    const app = process.env.APP_NAME ?? 'sso';
    const env = process.env.NODE_ENV ?? 'dev';
    return `${app}:${env}:iam:tenant:version:${tenantId}`;
  }
}
