-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  source_type text NOT NULL CHECK (source_type IN ('GITHUB', 'ZIP')),
  github_url text,
  default_branch text DEFAULT 'main',
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'CLONING', 'INDEXING', 'ANALYZING', 'SYNTHESIZING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  branch text,
  commit_sha text,
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  rubric_version text,
  summary text,
  coverage jsonb,
  error_code text,
  error_message text,
  token_cost_usd decimal(10, 6),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Agent Reports
CREATE TABLE IF NOT EXISTS agent_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  agent_name text NOT NULL CHECK (agent_name IN ('architecture', 'security', 'performance', 'quality', 'testing', 'manager')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')),
  score integer CHECK (score >= 0 AND score <= 100),
  findings jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  prompt_version text,
  model text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (review_id, agent_name)
);

-- Repository Files
CREATE TABLE IF NOT EXISTS repository_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  path text NOT NULL,
  language text,
  size_bytes integer NOT NULL,
  content_hash text NOT NULL,
  analysis_status text NOT NULL DEFAULT 'PENDING' CHECK (analysis_status IN ('PENDING', 'ANALYZED_FULL', 'SUMMARIZED', 'SKIPPED'))
);

-- Share Links
CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- LLM Usage Tracking
CREATE TABLE IF NOT EXISTS llm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  cost_usd decimal(10, 6) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('REVIEW_COMPLETE', 'REVIEW_FAILED', 'PROJECT_SHARED', 'SYSTEM')),
  title text NOT NULL,
  message text NOT NULL,
  link_url text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reports_review ON agent_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_repository_files_review ON repository_files(review_id);
CREATE INDEX IF NOT EXISTS idx_repository_files_hash ON repository_files(content_hash);
CREATE INDEX IF NOT EXISTS idx_share_links_review ON share_links(review_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_llm_usage_review ON llm_usage(review_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policies omitted (defined in migrations)

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
