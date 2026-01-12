import { Logger } from '../utils/logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log info messages', () => {
    Logger.info('Test message', { data: 'test' });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log error messages', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    Logger.error('Error message', new Error('Test error'));
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should log warning messages', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    Logger.warn('Warning message', { data: 'test' });
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});
