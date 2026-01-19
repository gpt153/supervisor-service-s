/**
 * Error handling utilities
 */

import { MCPError, ErrorCode } from '../types/index.js';

export class MCPServerError extends Error {
  code: ErrorCode;
  data?: any;

  constructor(code: ErrorCode, message: string, data?: any) {
    super(message);
    this.name = 'MCPServerError';
    this.code = code;
    this.data = data;
  }

  toMCPError(): MCPError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

export function createMCPError(
  code: ErrorCode,
  message: string,
  data?: any
): MCPError {
  return {
    code,
    message,
    data,
  };
}

export function handleError(error: unknown): MCPError {
  if (error instanceof MCPServerError) {
    return error.toMCPError();
  }

  if (error instanceof Error) {
    return createMCPError(
      ErrorCode.INTERNAL_ERROR,
      error.message,
      { stack: error.stack }
    );
  }

  return createMCPError(
    ErrorCode.INTERNAL_ERROR,
    'An unknown error occurred',
    { error: String(error) }
  );
}
