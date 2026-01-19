/**
 * LearningWatcher - File system watcher for automatic learning indexing
 *
 * Watches the learnings directory and automatically indexes new or modified
 * learning files.
 */

import fs from 'fs';
import path from 'path';
import { LearningsIndex } from './LearningsIndex.js';

export interface WatcherOptions {
  learningsDir?: string;
  projectId?: string;
  debounceMs?: number;
  onIndexed?: (filePath: string, learningId: string) => void;
  onError?: (error: Error, filePath: string) => void;
}

/**
 * LearningWatcher - Watches learning files and auto-indexes them
 */
export class LearningWatcher {
  private learningsIndex: LearningsIndex;
  private learningsDir: string;
  private projectId?: string;
  private watcher?: fs.FSWatcher;
  private debounceMs: number;
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private onIndexed?: (filePath: string, learningId: string) => void;
  private onError?: (error: Error, filePath: string) => void;

  constructor(learningsIndex: LearningsIndex, options: WatcherOptions = {}) {
    this.learningsIndex = learningsIndex;
    this.learningsDir = options.learningsDir || '/home/samuel/sv/docs/supervisor-learnings/learnings';
    this.projectId = options.projectId;
    this.debounceMs = options.debounceMs || 1000; // 1 second debounce
    this.debounceTimers = new Map();
    this.onIndexed = options.onIndexed;
    this.onError = options.onError;
  }

  /**
   * Start watching the learnings directory
   */
  start(): void {
    if (this.watcher) {
      console.warn('LearningWatcher already started');
      return;
    }

    console.log(`Starting LearningWatcher on: ${this.learningsDir}`);

    this.watcher = fs.watch(
      this.learningsDir,
      { recursive: false },
      (eventType, filename) => {
        if (!filename) return;

        // Only watch .md files, ignore template files
        if (!filename.endsWith('.md') || filename.startsWith('_')) {
          return;
        }

        const filePath = path.join(this.learningsDir, filename);

        // Debounce to avoid multiple triggers for the same file
        if (this.debounceTimers.has(filePath)) {
          clearTimeout(this.debounceTimers.get(filePath)!);
        }

        const timer = setTimeout(() => {
          this.handleFileChange(filePath);
          this.debounceTimers.delete(filePath);
        }, this.debounceMs);

        this.debounceTimers.set(filePath, timer);
      }
    );

    this.watcher.on('error', (error) => {
      console.error('LearningWatcher error:', error);
    });

    console.log('LearningWatcher started successfully');
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      console.log('LearningWatcher stopped');
    }

    // Clear any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(filePath: string): Promise<void> {
    try {
      // Check if file exists (could be deleted)
      const exists = await fs.promises.access(filePath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        console.log(`Learning file deleted: ${filePath}`);
        // Could implement deletion logic here if needed
        return;
      }

      console.log(`Indexing learning file: ${filePath}`);
      const learningId = await this.learningsIndex.indexLearning(filePath, this.projectId);

      console.log(`Successfully indexed learning: ${path.basename(filePath)} (ID: ${learningId})`);

      if (this.onIndexed) {
        this.onIndexed(filePath, learningId);
      }
    } catch (error) {
      console.error(`Failed to index learning ${filePath}:`, error);

      if (this.onError && error instanceof Error) {
        this.onError(error, filePath);
      }
    }
  }

  /**
   * Manually trigger indexing of a specific file
   */
  async indexFile(filename: string): Promise<string> {
    const filePath = path.join(this.learningsDir, filename);
    return await this.learningsIndex.indexLearning(filePath, this.projectId);
  }

  /**
   * Get current watch status
   */
  isWatching(): boolean {
    return this.watcher !== undefined;
  }
}
