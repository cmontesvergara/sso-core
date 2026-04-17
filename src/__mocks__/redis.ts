/**
 * Manual mock para Redis - usado automáticamente por Jest cuando se llama jest.mock('../redis')
 * Nota: Las funciones se crean como jest.fn() en el setup de Jest
 */

// Mock del cliente Redis
const mockRedisClient: any = {
  // Comandos básicos
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),

  // Sets
  sadd: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  sismember: jest.fn().mockResolvedValue(false),
  srem: jest.fn().mockResolvedValue(1),

  // Control de conexión
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn(),

  // Event listeners
  on: jest.fn(),

  // Estado
  status: 'ready',

  // Transacciones
  multi: jest.fn(() => ({
    exec: jest.fn().mockResolvedValue([]),
  })),

  // Scan para iteración
  scan: jest.fn().mockResolvedValue([null, []]),
};

// Funciones exportadas mockeadas
export const getRedisClient = jest.fn(() => mockRedisClient);
export const isRedisAvailable = jest.fn(() => true);
export const initRedis = jest.fn().mockResolvedValue(undefined);
export const closeRedis = jest.fn().mockResolvedValue(undefined);

// Helper para resetear mocks entre tests
export const resetRedisMock = () => {
  jest.clearAllMocks();
  // Resetear a valores por defecto
  mockRedisClient.status = 'ready';
};
