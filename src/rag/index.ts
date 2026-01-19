/**
 * RAG (Retrieval-Augmented Generation) module
 *
 * Provides learning indexing and semantic search capabilities.
 */

export { LearningsIndex, OpenAIEmbeddingProvider } from './LearningsIndex.js';
export { LearningWatcher } from './LearningWatcher.js';
export type { EmbeddingProvider, SearchLearningOptions, LearningStats } from './LearningsIndex.js';
export type { WatcherOptions } from './LearningWatcher.js';
