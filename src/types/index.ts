export type Role = 'USER' | 'ADMIN';

export type SourceType = 'GITHUB' | 'ZIP';

export type ReviewStatus =
  | 'QUEUED'
  | 'CLONING'
  | 'INDEXING'
  | 'ANALYZING'
  | 'SYNTHESIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AgentName = 'architecture' | 'security' | 'performance' | 'quality' | 'testing' | 'manager';

export type AgentStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

export type AnalysisStatus = 'PENDING' | 'ANALYZED_FULL' | 'SUMMARIZED' | 'SKIPPED';

export type NotificationType = 'REVIEW_COMPLETE' | 'REVIEW_FAILED' | 'PROJECT_SHARED' | 'SYSTEM';

export interface UserProfile {
  id: string;
  name: string;
  role: Role;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  source_type: SourceType;
  github_url: string | null;
  default_branch: string;
  owner_id: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  project_id: string;
  status: ReviewStatus;
  branch: string | null;
  commit_sha: string | null;
  overall_score: number | null;
  rubric_version: string | null;
  summary: string | null;
  coverage: ReviewCoverage | null;
  error_code: string | null;
  error_message: string | null;
  token_cost_usd: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ReviewCoverage {
  files_analyzed: number;
  files_total: number;
  files_skipped: number;
  lines_analyzed: number;
  lines_total: number;
}

export interface Finding {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  file: string;
  line_start: number;
  line_end: number;
  evidence: string;
  explanation: string;
  recommendation: string;
  suggested_fix: string | null;
  source: string;
  cwe: string | null;
  effort: 'low' | 'medium' | 'high';
}

export interface AgentReport {
  id: string;
  review_id: string;
  agent_name: AgentName;
  status: AgentStatus;
  score: number | null;
  findings: Finding[];
  recommendations: string[];
  prompt_version: string | null;
  model: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export interface RepositoryFile {
  id: string;
  review_id: string;
  path: string;
  language: string | null;
  size_bytes: number;
  content_hash: string;
  analysis_status: AnalysisStatus;
}

export interface ShareLink {
  id: string;
  review_id: string;
  token_hash: string;
  expires_at: string;
  created_by: string;
  revoked_at: string | null;
  created_at: string;
}

export interface LlmUsage {
  id: string;
  review_id: string;
  agent_name: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AgentInfo {
  name: AgentName;
  displayName: string;
  description: string;
  icon: string;
  color: string;
}

export const AGENTS: AgentInfo[] = [
  {
    name: 'architecture',
    displayName: 'Architecture',
    description: 'Analyzes project structure, modularization, and design patterns',
    icon: 'Network',
    color: '#6366f1',
  },
  {
    name: 'security',
    displayName: 'Security',
    description: 'Identifies vulnerabilities, injection risks, and security flaws',
    icon: 'Shield',
    color: '#ef4444',
  },
  {
    name: 'performance',
    displayName: 'Performance',
    description: 'Detects performance bottlenecks and optimization opportunities',
    icon: 'Zap',
    color: '#f59e0b',
  },
  {
    name: 'quality',
    displayName: 'Code Quality',
    description: 'Evaluates code readability, maintainability, and best practices',
    icon: 'Sparkles',
    color: '#10b981',
  },
  {
    name: 'testing',
    displayName: 'Testing',
    description: 'Assesses test coverage and identifies missing test cases',
    icon: 'FlaskConical',
    color: '#8b5cf6',
  },
  {
    name: 'manager',
    displayName: 'Manager',
    description: 'Consolidates all agent findings into a single prioritized report',
    icon: 'FileText',
    color: '#0ea5e9',
  },
];

export const AGENT_SCORE_WEIGHTS: Record<AgentName, number> = {
  security: 0.30,
  architecture: 0.20,
  quality: 0.20,
  performance: 0.15,
  testing: 0.15,
  manager: 0,
};
