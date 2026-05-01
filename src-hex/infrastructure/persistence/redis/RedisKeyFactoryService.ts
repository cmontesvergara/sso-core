/**
 * RedisKeyFactory
 *
 * Genera keys de Redis siguiendo el patrón:
 *   {APP_NAME}:{NODE_ENV}:{bounded-context}:{aggregate}:{query}:{ids}:v{version}
 *
 * Reglas:
 *   - Determinística: mismos inputs → misma key, siempre.
 *   - Única por contexto: env + bounded context + aggregate + query + ids.
 *   - Invalidable por grupo: :v{tenantVersion} permite invalidar TODO un
 *     grupo de tenant incrementando un solo contador (sin SCAN ni DEL).
 *
 * Versiones:
 *   - v0       → fijo para aggregates globales o de corta vida.
 *   - v{N}     → dinámico para aggregates que dependen de config de tenant
 *                (role, permission). N viene de TenantVersionService.
 *
 * Bounded contexts:
 *   - iam    → user, tenant, role, permission, email-verif, otp
 *   - auth   → session, refresh-token
 *   - oauth  → app, auth-code
 */
export class RedisKeyFactory {
  private readonly prefix: string;

  constructor() {
    const app = process.env.APP_NAME ?? 'sso';
    const env = process.env.NODE_ENV ?? 'dev';
    this.prefix = `${app}:${env}`;
  }

  // ── IAM: User ────────────────────────────────────────────────────────────
  // Users are global — not tenant-versioned (v0 fixed)

  /** `{p}:iam:user:by-id:{id}:v0` */
  user(id: string): string {
    return `${this.prefix}:iam:user:by-id:${id}:v0`;
  }

  /** `{p}:iam:user:by-email:{email}:v0` */
  userByEmail(email: string): string {
    return `${this.prefix}:iam:user:by-email:${email.toLowerCase()}:v0`;
  }

  /** `{p}:iam:user:by-nuid:{nuid}:v0` */
  userByNUID(nuid: string): string {
    return `${this.prefix}:iam:user:by-nuid:${nuid}:v0`;
  }

  /** `{p}:iam:user:by-tenant:{tenantId}:v0` */
  usersByTenant(tenantId: string): string {
    return `${this.prefix}:iam:user:by-tenant:${tenantId}:v0`;
  }

  // ── IAM: Tenant ───────────────────────────────────────────────────────────
  // Tenant entity itself is v0. Its version counter is managed by TenantVersionService.

  /** `{p}:iam:tenant:by-id:{id}:v0` */
  tenant(id: string): string {
    return `${this.prefix}:iam:tenant:by-id:${id}:v0`;
  }

  /** `{p}:iam:tenant:by-slug:{slug}:v0` */
  tenantBySlug(slug: string): string {
    return `${this.prefix}:iam:tenant:by-slug:${slug}:v0`;
  }

  /** `{p}:iam:tenant:list:v0` */
  tenantsList(): string {
    return `${this.prefix}:iam:tenant:list:v0`;
  }

  // ── IAM: Role ─────────────────────────────────────────────────────────────
  // Roles are tenant config — include tenantVersion so a single INCR
  // invalidates all role keys for that tenant without SCAN.

  /** `{p}:iam:role:by-id:{id}:v{tenantVersion}` */
  role(id: string, tenantVersion: number): string {
    return `${this.prefix}:iam:role:by-id:${id}:v${tenantVersion}`;
  }

  /** `{p}:iam:role:by-name:{name}:v{tenantVersion}` */
  roleByName(name: string, tenantVersion: number): string {
    return `${this.prefix}:iam:role:by-name:${name}:v${tenantVersion}`;
  }

  /** `{p}:iam:role:by-tenant:{tenantId}:v{tenantVersion}` */
  rolesByTenant(tenantId: string, tenantVersion: number): string {
    return `${this.prefix}:iam:role:by-tenant:${tenantId}:v${tenantVersion}`;
  }

  // ── IAM: Permission ───────────────────────────────────────────────────────

  /**
   * `{p}:iam:permission:by-role:{tenantId}:{roleId}:v{tenantVersion}`
   * Keeps the legacy permissionsByRole signature compatible.
   */
  permissionsByRole(tenantId: string, roleId: string, tenantVersion: number): string {
    return `${this.prefix}:iam:permission:by-role:${tenantId}:${roleId}:v${tenantVersion}`;
  }

  // ── IAM: EmailVerification ────────────────────────────────────────────────

  /** `{p}:iam:email-verif:by-id:{id}:v0` */
  emailVerification(id: string): string {
    return `${this.prefix}:iam:email-verif:by-id:${id}:v0`;
  }

  /** `{p}:iam:email-verif:by-token:{token}:v0` */
  emailVerificationByToken(token: string): string {
    return `${this.prefix}:iam:email-verif:by-token:${token}:v0`;
  }

  /** `{p}:iam:email-verif:by-user:{userId}:v0` */
  emailVerificationByUser(userId: string): string {
    return `${this.prefix}:iam:email-verif:by-user:${userId}:v0`;
  }

  // ── IAM: OTP ──────────────────────────────────────────────────────────────

  /** `{p}:iam:otp:by-id:{id}:v0` */
  otpSecret(id: string): string {
    return `${this.prefix}:iam:otp:by-id:${id}:v0`;
  }

  /** `{p}:iam:otp:by-user:{userId}:v0` */
  otpSecretByUser(userId: string): string {
    return `${this.prefix}:iam:otp:by-user:${userId}:v0`;
  }

  // ── Auth: Session ─────────────────────────────────────────────────────────

  /** `{p}:auth:session:by-id:{id}:v0` */
  session(id: string): string {
    return `${this.prefix}:auth:session:by-id:${id}:v0`;
  }

  /** `{p}:auth:session:by-user:{userId}:v0` */
  sessionsByUser(userId: string): string {
    return `${this.prefix}:auth:session:by-user:${userId}:v0`;
  }

  // ── Auth: RefreshToken ────────────────────────────────────────────────────

  /** `{p}:auth:refresh-token:by-id:{id}:v0` */
  refreshToken(id: string): string {
    return `${this.prefix}:auth:refresh-token:by-id:${id}:v0`;
  }

  /** `{p}:auth:refresh-token:by-hash:{hash}:v0` */
  refreshTokenByHash(hash: string): string {
    return `${this.prefix}:auth:refresh-token:by-hash:${hash}:v0`;
  }

  // ── OAuth: Application ────────────────────────────────────────────────────

  /** `{p}:oauth:app:by-id:{id}:v0` */
  application(id: string): string {
    return `${this.prefix}:oauth:app:by-id:${id}:v0`;
  }

  /** `{p}:oauth:app:by-client-id:{clientId}:v0` */
  applicationByClientId(clientId: string): string {
    return `${this.prefix}:oauth:app:by-client-id:${clientId}:v0`;
  }

  /** `{p}:oauth:app:tenant:{tenantId}:app:{appId}:v0` */
  tenantApplication(tenantId: string, appId: string): string {
    return `${this.prefix}:oauth:app:tenant:${tenantId}:app:${appId}:v0`;
  }

  // ── OAuth: AuthCode ───────────────────────────────────────────────────────

  /** `{p}:oauth:auth-code:by-id:{id}:v0` */
  authCode(id: string): string {
    return `${this.prefix}:oauth:auth-code:by-id:${id}:v0`;
  }

  /** `{p}:oauth:auth-code:by-code:{code}:v0` */
  authCodeByCode(code: string): string {
    return `${this.prefix}:oauth:auth-code:by-code:${code}:v0`;
  }
}