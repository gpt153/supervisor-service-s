/**
 * Base Evidence Collector
 * Abstract base class for all evidence collection implementations
 * Provides common file storage and database persistence methods
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { Logger } from 'pino';
import {
  EvidenceArtifact,
  EvidenceCollectorConfig,
  EvidenceStorageParams,
  TestType,
  PassFailStatus,
  ArtifactStorageError,
  EvidenceCollectionError,
} from '../types/evidence.js';

export abstract class EvidenceCollector {
  protected epicId: string;
  protected artifactDir: string;
  protected compressionEnabled: boolean;
  protected retentionDays: number;
  protected logger: Logger;

  constructor(config: EvidenceCollectorConfig, logger: Logger) {
    this.epicId = config.epicId;
    this.artifactDir = config.artifactDir || './evidence';
    this.compressionEnabled = config.compressionEnabled ?? true;
    this.retentionDays = config.retentionDays ?? 30;
    this.logger = logger;
  }

  /**
   * Create evidence directory structure
   * @param testType Type of test (ui, api, unit, integration)
   * @param timestamp Timestamp for organizing evidence
   */
  async createEvidenceDirectory(testType: TestType, timestamp: Date): Promise<string> {
    const dir = this.getEvidenceDirectoryPath(testType, timestamp);
    try {
      await fs.mkdir(dir, { recursive: true });
      this.logger.debug({ dir }, 'Created evidence directory');
      return dir;
    } catch (error) {
      throw new ArtifactStorageError(
        `Failed to create evidence directory: ${(error as Error).message}`,
        dir
      );
    }
  }

  /**
   * Get evidence directory path
   * Format: {artifactDir}/{epic-id}/{test-type}/{YYYY-MM-DD}/{HH-mm-ss}/
   */
  protected getEvidenceDirectoryPath(testType: TestType, timestamp: Date): string {
    const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = timestamp.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-mm-ss

    return join(this.artifactDir, this.epicId, testType, dateStr, timeStr);
  }

  /**
   * Get relative evidence path for database storage
   * Format: {epic-id}/{test-type}/{YYYY-MM-DD}/{HH-mm-ss}/{filename}
   */
  protected getRelativeEvidencePath(testType: TestType, timestamp: Date, filename: string): string {
    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    return join(this.epicId, testType, dateStr, timeStr, filename);
  }

  /**
   * Save file to evidence directory
   * @param directory Directory path from createEvidenceDirectory()
   * @param filename Name of file
   * @param content File content (string or buffer)
   * @param compress Whether to gzip the file
   * @returns Relative path for database storage
   */
  async saveArtifact(
    directory: string,
    filename: string,
    content: string | Buffer,
    testType: TestType,
    timestamp: Date,
    compress: boolean = this.compressionEnabled
  ): Promise<string> {
    try {
      const fullPath = join(directory, filename);
      const finalFilename = compress ? `${filename}.gz` : filename;
      const finalPath = join(directory, finalFilename);

      if (compress && typeof content === 'string') {
        const { gzipSync } = await import('zlib');
        const compressed = gzipSync(Buffer.from(content));
        await fs.writeFile(finalPath, compressed);
      } else {
        await fs.writeFile(fullPath, content);
      }

      const relativePath = this.getRelativeEvidencePath(testType, timestamp, finalFilename);
      this.logger.debug({ path: relativePath, size: content.length }, 'Saved artifact');

      return relativePath;
    } catch (error) {
      throw new ArtifactStorageError(
        `Failed to save artifact ${filename}: ${(error as Error).message}`,
        join(directory, filename)
      );
    }
  }

  /**
   * Save JSON artifact
   * Convenience method for JSON data
   */
  async saveJsonArtifact(
    directory: string,
    filename: string,
    data: any,
    testType: TestType,
    timestamp: Date,
    compress: boolean = this.compressionEnabled
  ): Promise<string> {
    const jsonContent = JSON.stringify(data, null, 2);
    return this.saveArtifact(
      directory,
      filename.endsWith('.json') ? filename : `${filename}.json`,
      jsonContent,
      testType,
      timestamp,
      compress
    );
  }

  /**
   * Calculate file hash for integrity verification
   */
  protected calculateFileHash(content: string | Buffer): string {
    const hash = createHash('sha256');
    if (typeof content === 'string') {
      hash.update(content);
    } else {
      hash.update(content);
    }
    return hash.digest('hex');
  }

  /**
   * Verify artifact exists and is readable
   */
  async verifyArtifact(artifactPath: string): Promise<boolean> {
    try {
      const fullPath = join(this.artifactDir, artifactPath);
      const stat = await fs.stat(fullPath);
      return stat.isFile();
    } catch {
      this.logger.warn({ path: artifactPath }, 'Artifact verification failed');
      return false;
    }
  }

  /**
   * Get artifact size
   */
  async getArtifactSize(artifactPath: string): Promise<number> {
    try {
      const fullPath = join(this.artifactDir, artifactPath);
      const stat = await fs.stat(fullPath);
      return stat.size;
    } catch (error) {
      throw new ArtifactStorageError(
        `Failed to get artifact size: ${(error as Error).message}`,
        artifactPath
      );
    }
  }

  /**
   * Abstract method - subclasses must implement
   */
  abstract collect(): Promise<void>;

  /**
   * Helper: Create evidence storage object with common fields
   */
  protected createEvidenceStorage(
    testType: TestType,
    testId: string,
    testName: string,
    expectedOutcome: string,
    actualOutcome: string,
    passFail: PassFailStatus,
    startTime: number
  ): EvidenceStorageParams {
    const endTime = Date.now();
    return {
      epicId: this.epicId,
      testId,
      testType,
      testName,
      passFail,
      expectedOutcome,
      actualOutcome,
      durationMs: endTime - startTime,
    };
  }

  /**
   * Clean up old evidence (30-day retention policy)
   */
  async cleanupOldEvidence(): Promise<number> {
    const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    try {
      const epicDir = join(this.artifactDir, this.epicId);
      const testTypeDirs = await fs.readdir(epicDir);

      for (const testType of testTypeDirs) {
        const testTypeDir = join(epicDir, testType);
        const dateDirs = await fs.readdir(testTypeDir);

        for (const dateDir of dateDirs) {
          const dateDirPath = join(testTypeDir, dateDir);
          const stat = await fs.stat(dateDirPath);

          // Parse date from directory name (YYYY-MM-DD)
          const dirDate = new Date(`${dateDir}T00:00:00Z`);

          if (dirDate < cutoffDate) {
            await this.deleteRecursive(dateDirPath);
            deletedCount++;
            this.logger.info({ dir: dateDirPath }, 'Deleted old evidence');
          }
        }
      }

      return deletedCount;
    } catch (error) {
      this.logger.error({ error }, 'Failed to cleanup old evidence');
      return deletedCount;
    }
  }

  /**
   * Recursively delete directory
   */
  private async deleteRecursive(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const path = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await this.deleteRecursive(path);
      } else {
        await fs.unlink(path);
      }
    }

    await fs.rmdir(dirPath);
  }

  /**
   * Get total evidence size for epic
   */
  async getTotalEvidenceSize(): Promise<number> {
    let totalSize = 0;

    try {
      const epicDir = join(this.artifactDir, this.epicId);
      const walk = async (dir: string): Promise<number> => {
        let size = 0;
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) {
            size += await walk(path);
          } else {
            const stat = await fs.stat(path);
            size += stat.size;
          }
        }

        return size;
      };

      totalSize = await walk(epicDir);
    } catch (error) {
      this.logger.warn({ error }, 'Failed to calculate total evidence size');
    }

    return totalSize;
  }
}
