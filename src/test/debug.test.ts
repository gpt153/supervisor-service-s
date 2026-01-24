import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debug, debugError, debugWarn } from './debug.js';

describe('debug utilities', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('debug', () => {
    it('should log message without data', () => {
      debug('Test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toMatch(/\[DEBUG \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Test message/);
    });

    it('should log message with data', () => {
      const testData = { foo: 'bar' };
      debug('Test message', testData);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toMatch(/\[DEBUG \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Test message/);
      expect(consoleLogSpy.mock.calls[0][1]).toEqual(testData);
    });
  });

  describe('debugError', () => {
    it('should log error message', () => {
      const error = new Error('Test error');
      debugError('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toMatch(/\[ERROR \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Error occurred/);
      expect(consoleErrorSpy.mock.calls[0][1]).toEqual(error);
    });
  });

  describe('debugWarn', () => {
    it('should log warning without data', () => {
      debugWarn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0][0]).toMatch(/\[WARN \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Warning message/);
    });

    it('should log warning with data', () => {
      const testData = { warning: 'details' };
      debugWarn('Warning message', testData);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0][0]).toMatch(/\[WARN \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Warning message/);
      expect(consoleWarnSpy.mock.calls[0][1]).toEqual(testData);
    });
  });
});
