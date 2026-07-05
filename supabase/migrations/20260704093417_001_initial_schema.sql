/*
# AI Code Review Platform - Initial Schema

1. Purpose
- Creates the core database tables for an AI-powered code review platform
- Supports GitHub and ZIP repository sources
- Tracks multi-agent code reviews with detailed findings
- Enables authenticated multi-tenant access with owner-scoped data

2. New Tables
- `user_profiles`: Extends auth.users with additional profile data (name, role)
- `projects`: User projects with GitHub URL or ZIP source
- `reviews`: Code review runs with status, scores, and metadata
- `agent_reports`: Per-agent findings and recommendations
- `repository_files`: Indexed files from analyzed repositories
- `share_links`: Time-limited public sharing links for reports
- `llm_usage`: Token usage tracking for cost analysis
- `notifications`: User notifications for review events

3. Security
- RLS enabled on all tables
- Owner-scoped policies for user data (projects, reviews, etc.)
- Admin role has elevated access for platform management

4. Important Notes
- All owner columns default to auth.uid() for seamless inserts
- Soft delete on projects for data recovery
- Cascading deletes maintain referential integrity
- Indexes on frequently queried columns for performance
*/

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

-- Create indexes for performance
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

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE repository_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- User Profiles Policies
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
CREATE POLICY "users_read_own_profile" ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin can see all profiles
DROP POLICY IF EXISTS "admin_read_all_profiles" ON user_profiles;
CREATE POLICY "admin_read_all_profiles" ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

-- Projects Policies
DROP POLICY IF EXISTS "users_read_own_projects" ON projects;
CREATE POLICY "users_read_own_projects" ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR is_admin());

DROP POLICY IF EXISTS "users_insert_own_projects" ON projects;
CREATE POLICY "users_insert_own_projects" ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "users_update_own_projects" ON projects;
CREATE POLICY "users_update_own_projects" ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "users_delete_own_projects" ON projects;
CREATE POLICY "users_delete_own_projects" ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id OR is_admin());

-- Reviews Policies (access through project ownership)
DROP POLICY IF EXISTS "users_read_own_reviews" ON reviews;
CREATE POLICY "users_read_own_reviews" ON reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = reviews.project_id AND projects.owner_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS "users_insert_own_reviews" ON reviews;
CREATE POLICY "users_insert_own_reviews" ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = reviews.project_id AND projects.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "users_update_own_reviews" ON reviews;
CREATE POLICY "users_update_own_reviews" ON reviews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = reviews.project_id AND projects.owner_id = auth.uid())
  );

-- Agent Reports Policies (same as reviews)
DROP POLICY IF EXISTS "users_read_own_agent_reports" ON agent_reports;
CREATE POLICY "users_read_own_agent_reports" ON agent_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = agent_reports.review_id AND projects.owner_id = auth.uid()
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "users_insert_own_agent_reports" ON agent_reports;
CREATE POLICY "users_insert_own_agent_reports" ON agent_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = agent_reports.review_id AND projects.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_update_own_agent_reports" ON agent_reports;
CREATE POLICY "users_update_own_agent_reports" ON agent_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = agent_reports.review_id AND projects.owner_id = auth.uid()
    )
  );

-- Repository Files Policies
DROP POLICY IF EXISTS "users_read_own_repo_files" ON repository_files;
CREATE POLICY "users_read_own_repo_files" ON repository_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = repository_files.review_id AND projects.owner_id = auth.uid()
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "users_insert_own_repo_files" ON repository_files;
CREATE POLICY "users_insert_own_repo_files" ON repository_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = repository_files.review_id AND projects.owner_id = auth.uid()
    )
  );

-- Share Links Policies
DROP POLICY IF EXISTS "users_read_own_share_links" ON share_links;
CREATE POLICY "users_read_own_share_links" ON share_links FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = share_links.review_id AND projects.owner_id = auth.uid()
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "users_insert_own_share_links" ON share_links;
CREATE POLICY "users_insert_own_share_links" ON share_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = share_links.review_id AND projects.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_delete_own_share_links" ON share_links;
CREATE POLICY "users_delete_own_share_links" ON share_links FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- Public access via share token (for anonymous users)
DROP POLICY IF EXISTS "public_access_share_links" ON share_links;
CREATE POLICY "public_access_share_links" ON share_links FOR SELECT
  TO anon, authenticated
  USING (token_hash = current_setting('request.jwt.claims->>share_token', true) AND revoked_at IS NULL AND expires_at > now());

-- LLM Usage Policies
DROP POLICY IF EXISTS "users_read_own_llm_usage" ON llm_usage;
CREATE POLICY "users_read_own_llm_usage" ON llm_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = llm_usage.review_id AND projects.owner_id = auth.uid()
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "users_insert_own_llm_usage" ON llm_usage;
CREATE POLICY "users_insert_own_llm_usage" ON llm_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      JOIN projects ON projects.id = reviews.project_id 
      WHERE reviews.id = llm_usage.review_id AND projects.owner_id = auth.uid()
    )
  );

-- Notifications Policies
DROP POLICY IF EXISTS "users_read_own_notifications" ON notifications;
CREATE POLICY "users_read_own_notifications" ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "users_insert_own_notifications" ON notifications;
CREATE POLICY "users_insert_own_notifications" ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
CREATE POLICY "users_update_own_notifications" ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();