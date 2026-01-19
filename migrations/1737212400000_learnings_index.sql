-- Migration: 005_learnings_index
-- Description: Create tables for RAG-based knowledge management with pgvector
-- For EPIC-009: Learnings Index (RAG)

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge sources table
-- Tracks different sources of knowledge (docs, issues, code, ADRs, etc.)
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL, -- adr, issue, epic, task, code, documentation, external
  source_id VARCHAR(255), -- Reference to the source (e.g., epic_id, issue_id, file_path)
  title VARCHAR(500) NOT NULL,
  url TEXT,
  file_path TEXT,
  author VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  indexed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for knowledge sources
CREATE INDEX idx_knowledge_sources_project_id ON knowledge_sources(project_id);
CREATE INDEX idx_knowledge_sources_type ON knowledge_sources(source_type);
CREATE INDEX idx_knowledge_sources_source_id ON knowledge_sources(source_id);

-- Knowledge chunks table
-- Stores chunked text with embeddings for semantic search
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL, -- Position in the source document
  content TEXT NOT NULL,
  content_hash VARCHAR(64), -- SHA-256 hash for deduplication
  embedding vector(1536), -- OpenAI ada-002 produces 1536-dim vectors
  token_count INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for knowledge chunks
CREATE INDEX idx_knowledge_chunks_source_id ON knowledge_chunks(source_id);
CREATE INDEX idx_knowledge_chunks_project_id ON knowledge_chunks(project_id);
CREATE INDEX idx_knowledge_chunks_hash ON knowledge_chunks(content_hash);

-- Vector similarity index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster build time, slower search)
-- CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- Learnings table
-- Extracted insights, patterns, and best practices
CREATE TABLE IF NOT EXISTS learnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  learning_type VARCHAR(50) NOT NULL, -- pattern, best_practice, antipattern, lesson_learned, tip
  category VARCHAR(100), -- database, api, frontend, devops, testing, etc.
  confidence_score NUMERIC(3,2) DEFAULT 0.50 CHECK (confidence_score BETWEEN 0 AND 1),
  impact_level VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  source_chunks UUID[], -- Array of knowledge_chunk IDs that support this learning
  tags TEXT[],
  embedding vector(1536),
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(255),
  verified_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for learnings
CREATE INDEX idx_learnings_project_id ON learnings(project_id);
CREATE INDEX idx_learnings_type ON learnings(learning_type);
CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_confidence ON learnings(confidence_score);
CREATE INDEX idx_learnings_impact ON learnings(impact_level);
CREATE INDEX idx_learnings_tags ON learnings USING GIN(tags);
CREATE INDEX idx_learnings_verified ON learnings(verified);

-- Vector index for learnings
CREATE INDEX idx_learnings_embedding ON learnings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Learning applications table
-- Track when and where learnings are applied
CREATE TABLE IF NOT EXISTS learning_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_id UUID REFERENCES learnings(id) ON DELETE CASCADE,
  applied_to_type VARCHAR(50) NOT NULL, -- epic, issue, task, code_review
  applied_to_id UUID,
  context TEXT,
  outcome VARCHAR(50), -- successful, failed, partial
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for learning applications
CREATE INDEX idx_learning_applications_learning_id ON learning_applications(learning_id);
CREATE INDEX idx_learning_applications_outcome ON learning_applications(outcome);

-- Search queries table
-- Log user queries for analytics and improvement
CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_embedding vector(1536),
  search_type VARCHAR(50) NOT NULL, -- semantic, keyword, hybrid
  result_count INTEGER,
  top_result_id UUID REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
  top_result_similarity NUMERIC(5,4),
  filters JSONB DEFAULT '{}',
  user_feedback VARCHAR(50), -- helpful, not_helpful, partial
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search queries
CREATE INDEX idx_search_queries_project_id ON search_queries(project_id);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);
CREATE INDEX idx_search_queries_feedback ON search_queries(user_feedback);

-- Function to search knowledge chunks by semantic similarity
CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  query_embedding vector(1536),
  p_project_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_min_similarity NUMERIC DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  content TEXT,
  similarity NUMERIC,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id as chunk_id,
    kc.source_id,
    kc.content,
    ROUND((1 - (kc.embedding <=> query_embedding))::NUMERIC, 4) as similarity,
    kc.metadata
  FROM knowledge_chunks kc
  WHERE
    (p_project_id IS NULL OR kc.project_id = p_project_id)
    AND (1 - (kc.embedding <=> query_embedding)) >= p_min_similarity
  ORDER BY kc.embedding <=> query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to search learnings by semantic similarity
CREATE OR REPLACE FUNCTION search_learnings(
  query_embedding vector(1536),
  p_project_id UUID DEFAULT NULL,
  p_category VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_min_similarity NUMERIC DEFAULT 0.7
)
RETURNS TABLE (
  learning_id UUID,
  title VARCHAR,
  content TEXT,
  learning_type VARCHAR,
  category VARCHAR,
  similarity NUMERIC,
  confidence_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id as learning_id,
    l.title,
    l.content,
    l.learning_type,
    l.category,
    ROUND((1 - (l.embedding <=> query_embedding))::NUMERIC, 4) as similarity,
    l.confidence_score
  FROM learnings l
  WHERE
    (p_project_id IS NULL OR l.project_id = p_project_id)
    AND (p_category IS NULL OR l.category = p_category)
    AND (1 - (l.embedding <=> query_embedding)) >= p_min_similarity
  ORDER BY l.embedding <=> query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar learnings (for deduplication)
CREATE OR REPLACE FUNCTION find_similar_learnings(
  p_embedding vector(1536),
  p_project_id UUID,
  p_similarity_threshold NUMERIC DEFAULT 0.9
)
RETURNS TABLE (
  learning_id UUID,
  title VARCHAR,
  similarity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id as learning_id,
    l.title,
    ROUND((1 - (l.embedding <=> p_embedding))::NUMERIC, 4) as similarity
  FROM learnings l
  WHERE
    l.project_id = p_project_id
    AND (1 - (l.embedding <=> p_embedding)) >= p_similarity_threshold
  ORDER BY l.embedding <=> p_embedding
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to increment learning usage
CREATE OR REPLACE FUNCTION increment_learning_usage(p_learning_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE learnings
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_learning_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track learning applications
CREATE OR REPLACE FUNCTION track_learning_application()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM increment_learning_usage(NEW.learning_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_learning_usage
  AFTER INSERT ON learning_applications
  FOR EACH ROW
  EXECUTE FUNCTION track_learning_application();

-- Apply update triggers
CREATE TRIGGER update_knowledge_sources_updated_at BEFORE UPDATE ON knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_chunks_updated_at BEFORE UPDATE ON knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learnings_updated_at BEFORE UPDATE ON learnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for learning effectiveness
CREATE OR REPLACE VIEW learning_effectiveness AS
SELECT
  l.id,
  l.title,
  l.learning_type,
  l.category,
  l.confidence_score,
  l.usage_count,
  COUNT(la.id) as application_count,
  COUNT(*) FILTER (WHERE la.outcome = 'successful') as successful_applications,
  COUNT(*) FILTER (WHERE la.outcome = 'failed') as failed_applications,
  CASE
    WHEN COUNT(la.id) > 0 THEN
      ROUND((COUNT(*) FILTER (WHERE la.outcome = 'successful')::NUMERIC / COUNT(la.id)::NUMERIC) * 100, 2)
    ELSE NULL
  END as success_rate_percent
FROM learnings l
LEFT JOIN learning_applications la ON l.id = la.learning_id
GROUP BY l.id, l.title, l.learning_type, l.category, l.confidence_score, l.usage_count;

-- View for knowledge coverage by project
CREATE OR REPLACE VIEW knowledge_coverage_by_project AS
SELECT
  p.id as project_id,
  p.name as project_name,
  COUNT(DISTINCT ks.id) as source_count,
  COUNT(DISTINCT kc.id) as chunk_count,
  COUNT(DISTINCT l.id) as learning_count,
  SUM(kc.token_count) as total_tokens,
  COUNT(DISTINCT ks.source_type) as source_type_count,
  array_agg(DISTINCT ks.source_type) as source_types
FROM projects p
LEFT JOIN knowledge_sources ks ON p.id = ks.project_id
LEFT JOIN knowledge_chunks kc ON ks.id = kc.source_id
LEFT JOIN learnings l ON p.id = l.project_id
GROUP BY p.id, p.name;

-- View for popular search queries
CREATE OR REPLACE VIEW popular_search_queries AS
SELECT
  project_id,
  query_text,
  COUNT(*) as query_count,
  AVG(result_count) as avg_results,
  COUNT(*) FILTER (WHERE user_feedback = 'helpful') as helpful_count,
  COUNT(*) FILTER (WHERE user_feedback = 'not_helpful') as not_helpful_count,
  MAX(created_at) as last_queried
FROM search_queries
GROUP BY project_id, query_text
HAVING COUNT(*) > 1
ORDER BY query_count DESC
LIMIT 50;
