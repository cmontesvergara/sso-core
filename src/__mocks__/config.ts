/**
 * Manual mock para Config - usado automáticamente por Jest cuando se llama jest.mock('../config')
 * Este mock evita que el singleton ConfigManager se instancie antes de configurar los tests
 */

export const Config = {
  get: jest.fn((key: string, defaultValue: any) => {
    // Default implementation - puede ser sobrescrita en cada test
    if (key === 'jwt.iss') return 'https://sso.bigso.co';
    return defaultValue;
  }),
  set: jest.fn(),
  getAll: jest.fn(() => ({})),
  load: jest.fn().mockResolvedValue(undefined),
};

// Also export as default for compatibility
export default Config;
