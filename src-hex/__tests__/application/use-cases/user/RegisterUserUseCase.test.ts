import { RegisterUserUseCase } from '@hex/application/use-cases/user/RegisterUserUseCase';

const userRepository = {
  findByEmail: jest.fn().mockResolvedValue(null),
  findByNUID: jest.fn().mockResolvedValue(null),
  findById: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
};

const tenantRepository = {
  findById: jest.fn(),
  findBySlug: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  isSlugAvailable: jest.fn().mockResolvedValue(true),
};

const emailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  send2FAEmail: jest.fn().mockResolvedValue(undefined),
};

const auditService = {
  log: jest.fn().mockResolvedValue(undefined),
  logSecurity: jest.fn().mockResolvedValue(undefined),
  logAuthSuccess: jest.fn().mockResolvedValue(undefined),
  logAuthFailure: jest.fn().mockResolvedValue(undefined),
};

const eventBus = {
  publish: jest.fn().mockResolvedValue(undefined),
  publishAll: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
};

const passwordHasher = {
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn().mockResolvedValue(true),
};

describe('RegisterUserUseCase', () => {
  let registerUseCase: RegisterUserUseCase;

  const validInput = {
    email: 'newuser@bigso.co',
    password: 'StrongPass123!',
    firstName: 'Maria',
    lastName: 'Garcia',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    registerUseCase = new RegisterUserUseCase(
      userRepository as any,
      tenantRepository as any,
      emailService as any,
      auditService as any,
      eventBus as any,
      passwordHasher as any
    );
  });

  it('should create a user and return a result', async () => {
    const result = await registerUseCase.execute(validInput);

    expect(result.email).toBe('newuser@bigso.co');
    expect(result.firstName).toBe('Maria');
    expect(result.userStatus).toBe('pending');
  });

  it('should save the user to the repository', async () => {
    await registerUseCase.execute(validInput);
    expect(userRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should send a welcome email', async () => {
    await registerUseCase.execute(validInput);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it('should publish UserCreatedEvent', async () => {
    await registerUseCase.execute(validInput);
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('should throw UserAlreadyExistsError when email is taken', async () => {
    userRepository.findByEmail.mockResolvedValueOnce({ id: { value: 'existing-user' } });
    await expect(registerUseCase.execute(validInput)).rejects.toThrow();
  });

  it('should throw WeakPasswordError on weak password', async () => {
    await expect(
      registerUseCase.execute({ ...validInput, password: '123' })
    ).rejects.toThrow();
  });

  it('should create tenant if tenantName is provided', async () => {
    tenantRepository.findBySlug.mockResolvedValueOnce(null);
    await registerUseCase.execute({ ...validInput, tenantName: 'Mi Empresa' });
    expect(tenantRepository.save).toHaveBeenCalledTimes(1);
  });
});
