/**
 * Instance ID Generation Service (Epic 007-A)
 * Generates unique, user-visible instance IDs with format: {project}-{type}-{hash}
 *
 * Design:
 * - Format: {project}-{type}-{short-hash}
 * - Short-hash: First 6 chars of SHA256(timestamp + random + project + type)
 * - Collision rate: ~1 in 16 million per project (2^36 combinations)
 * - Example: odin-PS-8f4a2b, meta-MS-a9b2c4
 */

import crypto from 'crypto';
import { InstanceType, INSTANCE_ID_PATTERN } from '../types/session.js';

/**
 * Generate a unique instance ID
 *
 * @param project Project name (e.g., 'odin', 'consilio', 'meta')
 * @param type Instance type ('PS' or 'MS')
 * @returns Instance ID in format {project}-{type}-{hash}
 *
 * @example
 * const id = generateInstanceId('odin', 'PS');
 * // Returns: 'odin-PS-8f4a2b'
 */
export function generateInstanceId(project: string, type: InstanceType): string {
  // Validate inputs
  validateProject(project);
  validateInstanceType(type);

  // Generate hash source: timestamp + random + project + type
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const source = `${timestamp}${random}${project}${type}`;

  // Create SHA256 hash and take first 6 characters
  const hash = crypto
    .createHash('sha256')
    .update(source, 'utf-8')
    .digest('hex')
    .substring(0, 6);

  const instanceId = `${project}-${type}-${hash}`;

  // Validate format before returning
  if (!validateInstanceId(instanceId)) {
    throw new Error(`Generated invalid instance ID format: ${instanceId}`);
  }

  return instanceId;
}

/**
 * Validate an instance ID format
 *
 * @param id Instance ID to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * validateInstanceId('odin-PS-8f4a2b'); // true
 * validateInstanceId('invalid'); // false
 */
export function validateInstanceId(id: string): boolean {
  return INSTANCE_ID_PATTERN.test(id);
}

/**
 * Parse instance ID into components
 *
 * @param id Instance ID to parse
 * @returns Object with project, type, and hash
 * @throws Error if ID format is invalid
 *
 * @example
 * const parts = parseInstanceId('odin-PS-8f4a2b');
 * // Returns: { project: 'odin', type: 'PS', hash: '8f4a2b' }
 */
export function parseInstanceId(
  id: string
): { project: string; type: InstanceType; hash: string } {
  if (!validateInstanceId(id)) {
    throw new Error(`Invalid instance ID format: ${id}`);
  }

  const parts = id.split('-');
  const hash = parts.pop()!;
  const type = parts.pop() as InstanceType;
  const project = parts.join('-'); // Project may contain hyphens

  return { project, type, hash };
}

/**
 * Validate project name
 *
 * @param project Project name to validate
 * @throws Error if project is invalid
 */
function validateProject(project: string): void {
  if (!project || typeof project !== 'string') {
    throw new Error('Project must be a non-empty string');
  }

  if (project.length > 64) {
    throw new Error('Project name too long (max 64 characters)');
  }

  // Allow alphanumeric and hyphens
  if (!/^[a-z0-9-]+$/.test(project)) {
    throw new Error('Project name must contain only lowercase letters, numbers, and hyphens');
  }
}

/**
 * Validate instance type
 *
 * @param type Instance type to validate
 * @throws Error if type is invalid
 */
function validateInstanceType(type: InstanceType): void {
  if (type !== 'PS' && type !== 'MS') {
    throw new Error(`Invalid instance type: ${type}. Must be 'PS' or 'MS'`);
  }
}
