import { ApplicationId } from '../value-objects/Ids';
import { TenantId } from '../value-objects/TenantId';

/**
 * Application Entity
 * Represents an OAuth application/client registered in the system
 * Aligned with Prisma: applications table
 * Immutable
 */
export class Application {
  constructor(
    private readonly _id: ApplicationId,
    private readonly _appId: string, // Unique client identifier
    private readonly _name: string,
    private readonly _url: string, // Application URL
    private readonly _description: string | null,
    private readonly _logoUrl: string | null,
    private readonly _backendUrl: string | null,
    private readonly _isActive: boolean, // Prisma uses boolean, not enum
    private readonly _audience: string | null,
    private readonly _scope: string[], // Allowed scopes
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {
    Object.freeze(this);
    Object.freeze(this._scope);
  }

  // Getters
  get id(): ApplicationId {
    return this._id;
  }

  get appId(): string {
    return this._appId;
  }

  get name(): string {
    return this._name;
  }

  get url(): string {
    return this._url;
  }

  get description(): string | null {
    return this._description;
  }

  get logoUrl(): string | null {
    return this._logoUrl;
  }

  get backendUrl(): string | null {
    return this._backendUrl;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get audience(): string | null {
    return this._audience;
  }

  get scope(): ReadonlyArray<string> {
    return this._scope;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  /**
   * Check if application is active
   */
  isActiveApplication(): boolean {
    return this._isActive;
  }

  /**
   * Check if scope is allowed
   */
  isScopeAllowed(requestedScope: string): boolean {
    return this._scope.includes(requestedScope) || requestedScope === 'openid';
  }

  /**
   * Validate requested scopes
   */
  validateScopes(requestedScopes: string[]): string[] {
    return requestedScopes.filter((s) => this.isScopeAllowed(s));
  }

  /**
   * Create application with updated activation status
   */
  withActiveStatus(isActive: boolean): Application {
    return new Application(
      this._id,
      this._appId,
      this._name,
      this._url,
      this._description,
      this._logoUrl,
      this._backendUrl,
      isActive,
      this._audience,
      this._scope,
      this._createdAt,
      new Date()
    );
  }
}

/**
 * TenantApplication Entity
 * Represents an application's configuration within a specific tenant
 * Aligned with Prisma: tenant_apps table
 * Immutable
 */
export class TenantApplication {
  constructor(
    private readonly _id: string,
    private readonly _tenantId: TenantId,
    private readonly _applicationId: ApplicationId,
    private readonly _isEnabled: boolean,
    private readonly _config: Record<string, any> | null,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {
    Object.freeze(this);
    Object.freeze(this._config);
  }

  get id(): string {
    return this._id;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get applicationId(): ApplicationId {
    return this._applicationId;
  }

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  get config(): Record<string, any> | null {
    return this._config ? { ...this._config } : null;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  /**
   * Enable the application for this tenant
   */
  enable(): TenantApplication {
    return new TenantApplication(
      this._id,
      this._tenantId,
      this._applicationId,
      true,
      this._config,
      this._createdAt,
      new Date()
    );
  }

  /**
   * Disable the application for this tenant
   */
  disable(): TenantApplication {
    return new TenantApplication(
      this._id,
      this._tenantId,
      this._applicationId,
      false,
      this._config,
      this._createdAt,
      new Date()
    );
  }
}
