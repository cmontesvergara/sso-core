/**
 * Tests para Logger
 * Verifica que los métodos del Logger produzcan el formato correcto de salida
 */

// Create arrays to capture log outputs BEFORE importing Logger
const logOutputs: { level: string; message: string; data?: any; timestamp: string }[] = [];

// Mock console methods before any imports
const originalConsole = { ...console };

(global as any).console = {
  ...console,
  log: (msg: string) => {
    try {
      const parsed = JSON.parse(msg);
      logOutputs.push(parsed);
    } catch {
      // Ignore non-JSON logs
    }
  },
  warn: (msg: string) => {
    try {
      const parsed = JSON.parse(msg);
      logOutputs.push(parsed);
    } catch {
      // Ignore non-JSON logs
    }
  },
  error: (msg: string) => {
    try {
      const parsed = JSON.parse(msg);
      logOutputs.push(parsed);
    } catch {
      // Ignore non-JSON logs
    }
  },
};

import { Logger } from '../../src/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    logOutputs.length = 0; // Clear array
  });

  afterAll(() => {
    // Restore original console
    (global as any).console = originalConsole;
  });

  it('should log info messages with correct format', () => {
    Logger.info('Test message', { data: 'test' });

    expect(logOutputs.length).toBe(1);
    expect(logOutputs[0].level).toBe('INFO');
    expect(logOutputs[0].message).toBe('Test message');
    expect(logOutputs[0].data).toEqual({ data: 'test' });
    expect(logOutputs[0].timestamp).toBeDefined();
  });

  it('should log error messages with correct format', () => {
    Logger.error('Error message', { error: 'Test error' });

    expect(logOutputs.length).toBe(1);
    expect(logOutputs[0].level).toBe('ERROR');
    expect(logOutputs[0].message).toBe('Error message');
  });

  it('should log warning messages with correct format', () => {
    Logger.warn('Warning message', { data: 'test' });

    expect(logOutputs.length).toBe(1);
    expect(logOutputs[0].level).toBe('WARN');
    expect(logOutputs[0].message).toBe('Warning message');
  });

  it('should log debug messages with correct format', () => {
    Logger.debug('Debug message', { data: 'test' });

    expect(logOutputs.length).toBe(1);
    expect(logOutputs[0].level).toBe('DEBUG');
    expect(logOutputs[0].message).toBe('Debug message');
  });
});
