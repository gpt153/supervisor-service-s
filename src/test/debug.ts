/**
 * Debug utility function for testing and development
 *
 * @param message - Debug message to log
 * @param data - Optional data to log alongside the message
 */
export function debug(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();

  if (data !== undefined) {
    console.log(`[DEBUG ${timestamp}] ${message}`, data);
  } else {
    console.log(`[DEBUG ${timestamp}] ${message}`);
  }
}

/**
 * Debug error utility
 *
 * @param message - Error message
 * @param error - Error object or data
 */
export function debugError(message: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  console.error(`[ERROR ${timestamp}] ${message}`, error);
}

/**
 * Debug warning utility
 *
 * @param message - Warning message
 * @param data - Optional data
 */
export function debugWarn(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();

  if (data !== undefined) {
    console.warn(`[WARN ${timestamp}] ${message}`, data);
  } else {
    console.warn(`[WARN ${timestamp}] ${message}`);
  }
}
