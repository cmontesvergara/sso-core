export class SuperTokensException extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'SuperTokensException';
  }
}

export class BadInputException extends SuperTokensException {
  constructor(message: string) {
    super(400, 'BAD_INPUT_EXCEPTION', message);
    this.name = 'BadInputException';
  }
}

export class UnauthorizedException extends SuperTokensException {
  constructor(message: string) {
    super(401, 'UNAUTHORIZED_EXCEPTION', message);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends SuperTokensException {
  constructor(message: string) {
    super(403, 'FORBIDDEN_EXCEPTION', message);
    this.name = 'ForbiddenException';
  }
}

export class TenantDoesNotExistException extends SuperTokensException {
  constructor(tenantId: string) {
    super(404, 'TENANT_NOT_FOUND', `Tenant with id ${tenantId} does not exist`);
    this.name = 'TenantDoesNotExistException';
  }
}

export class UserDoesNotExistException extends SuperTokensException {
  constructor(userId: string) {
    super(404, 'USER_NOT_FOUND', `User with id ${userId} does not exist`);
    this.name = 'UserDoesNotExistException';
  }
}

export class UserAlreadyExistsException extends SuperTokensException {
  constructor(email: string) {
    super(409, 'USER_ALREADY_EXISTS', `User with email ${email} already exists`);
    this.name = 'UserAlreadyExistsException';
  }
}

export class InvalidSessionException extends SuperTokensException {
  constructor(message: string = 'Session is invalid or expired') {
    super(401, 'INVALID_SESSION', message);
    this.name = 'InvalidSessionException';
  }
}

export class InvalidTokenException extends SuperTokensException {
  constructor(message: string = 'Token is invalid or expired') {
    super(401, 'INVALID_TOKEN', message);
    this.name = 'InvalidTokenException';
  }
}
