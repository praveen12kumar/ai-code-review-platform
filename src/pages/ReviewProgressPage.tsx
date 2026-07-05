import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, Button, Badge } from '../components/ui';
import type { Review, AgentReport, Project } from '../types';
import { AGENTS } from '../types';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Network,
  Shield,
  Zap,
  Sparkles,
  FlaskConical,
  FileText,
  FileSearch,
} from 'lucide-react';
import { formatRelativeTime } from '../lib/utils';
import { cn } from '../lib/utils';

const agentIcons: Record<string, React.ElementType> = {
  architecture: Network,
  security: Shield,
  performance: Zap,
  quality: Sparkles,
  testing: FlaskConical,
  manager: FileText,
};

interface ReviewLog {
  id: string;
  message: string;
  created_at: string;
}

const STAGE_ORDER: Review['status'][] = [
  'QUEUED',
  'CLONING',
  'INDEXING',
  'ANALYZING',
  'SYNTHESIZING',
  'COMPLETED',
];

function stageProgress(status: Review['status']): number {
  const idx = STAGE_ORDER.indexOf(status);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
}

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

export function ReviewProgressPage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [agentReports, setAgentReports] = useState<AgentReport[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const reviewStatusRef = useRef<string | null>(null);

  const fetchLatest = useCallback(async (reviewId: string) => {
    try {
      const [reviewRes, reportsRes, logsRes] = await Promise.all([
        supabase
          .from('reviews')
          .select('*, project:projects(*)')
          .eq('id', reviewId)
          .maybeSingle(),
        supabase.from('agent_reports').select('*').eq('review_id', reviewId),
        supabase
          .from('review_logs')
          .select('id, message, created_at')
          .eq('review_id', reviewId)
          .order('created_at', { ascending: true }),
      ]);

      if (reviewRes.data) {
        setReview(reviewRes.data as Review);
        setProject((reviewRes.data as any).project as Project);
        reviewStatusRef.current = reviewRes.data.status;
      }
      if (reportsRes.data) setAgentReports(reportsRes.data as AgentReport[]);
      if (logsRes.data) setLogs(logsRes.data as ReviewLog[]);
    } catch (error) {
      console.error('Error polling review:', error);
    }
  }, []);

  useEffect(() => {
    if (!id) return;

    async function initialLoad() {
      await fetchLatest(id!);
      setLoading(false);
    }
    initialLoad();

    // Poll every 3 seconds until the review reaches a terminal state
    const intervalId = setInterval(async () => {
      if (reviewStatusRef.current && TERMINAL_STATUSES.includes(reviewStatusRef.current)) {
        clearInterval(intervalId);
        return;
      }
      await fetchLatest(id!);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [id, fetchLatest]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getAgentStatus = (agentName: string) => {
    const report = agentReports.find((r) => r.agent_name === agentName);
    return report?.status || 'PENDING';
  };

  const getAgentScore = (agentName: string) => {
    const report = agentReports.find((r) => r.agent_name === agentName);
    return report?.score;
  };

  const isReviewComplete =
    review && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(review.status);

  const handleCancel = useCallback(async () => {
    if (!review || cancelling) return;
    setCancelling(true);
    try {
      await supabase
        .from('reviews')
        .update({ status: 'CANCELLED', completed_at: new Date().toISOString() })
        .eq('id', review.id);
    } catch (error) {
      console.error('Error cancelling review:', error);
    } finally {
      setCancelling(false);
    }
  }, [review, cancelling]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!review || !project) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Review not found</p>
        <Link to="/projects">
          <Button variant="outline" className="mt-4">
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const progress = stageProgress(review.status);
  const runningAgents = agentReports.filter((r) => r.status === 'RUNNING').length;
  const completedAgents = agentReports.filter((r) => r.status === 'SUCCEEDED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to={`/projects/${project.id}`} className="hover:text-slate-700">
              {project.name}
            </Link>
            <span>/</span>
            <span>Review</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Code Review {isReviewComplete ? 'Results' : 'in Progress'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isReviewComplete && (
            <Link to={`/reviews/${review.id}/report`}>
              <Button>View Report</Button>
            </Link>
          )}
          {!isReviewComplete && (
            <Button
              variant="outline"
              className="gap-2 text-red-600 hover:bg-red-50"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Cancel Review
            </Button>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <Card padding="lg">
        <div className="flex items-center gap-6">
          <div
            className={cn(
              'w-20 h-20 rounded-xl flex items-center justify-center',
              isReviewComplete
                ? review.status === 'COMPLETED'
                  ? 'bg-emerald-100'
                  : 'bg-red-100'
                : 'bg-blue-100'
            )}
          >
            {isReviewComplete ? (
              review.status === 'COMPLETED' ? (
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              ) : (
                <XCircle className="w-10 h-10 text-red-600" />
              )
            ) : (
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge
                className={cn(
                  'text-lg px-4 py-1',
                  review.status === 'COMPLETED' && 'bg-emerald-500',
                  review.status === 'FAILED' && 'bg-red-500',
                  review.status === 'CANCELLED' && 'bg-slate-500',
                  ['QUEUED', 'CLONING', 'INDEXING', 'ANALYZING', 'SYNTHESIZING'].includes(review.status) && 'bg-blue-500'
                )}
              >
                {review.status}
              </Badge>
              {review.overall_score !== null && review.overall_score !== undefined && (
                <span className="text-3xl font-bold text-slate-900">
                  Score: {review.overall_score}
                </span>
              )}
            </div>
            <p className="text-slate-500">
              Started {formatRelativeTime(review.created_at)}
              {review.completed_at && ` and completed ${formatRelativeTime(review.completed_at)}`}
            </p>
            {!isReviewComplete && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm text-slate-500 mb-1">
                  <span>
                    {runningAgents > 0
                      ? `${completedAgents}/${AGENTS.length} agents done · ${runningAgents} running`
                      : `${completedAgents}/${AGENTS.length} agents done`}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Agent Progress */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent) => {
          const status = getAgentStatus(agent.name);
          const score = getAgentScore(agent.name);
          const Icon = agentIcons[agent.name] || FileSearch;

          return (
            <Card key={agent.name} padding="md">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${agent.color}15` }}
                >
                  <Icon className="w-6 h-6" style={{ color: agent.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-slate-900">{agent.displayName}</h3>
                    {score !== null && score !== undefined && (
                      <span className="text-lg font-bold text-slate-900">{score}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-2 line-clamp-2">
                    {agent.description}
                  </p>
                  <div className="flex items-center gap-2">
                    {status === 'PENDING' && (
                      <Badge variant="default" size="sm">Pending</Badge>
                    )}
                    {status === 'RUNNING' && (
                      <Badge className="bg-blue-100 text-blue-700" size="sm">
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        Running
                      </Badge>
                    )}
                    {status === 'SUCCEEDED' && (
                      <Badge className="bg-emerald-100 text-emerald-700" size="sm">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                    {status === 'FAILED' && (
                      <Badge className="bg-red-100 text-red-700" size="sm">
                        <XCircle className="w-3 h-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    {status === 'SKIPPED' && (
                      <Badge className="bg-slate-100 text-slate-600" size="sm">
                        Skipped
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Live Logs */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Activity Log</h3>
          {!isReviewComplete && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              Live
            </div>
          )}
        </div>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto max-h-80 overflow-y-auto">
          <div className="space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-500">Waiting for activity...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="text-slate-300">
                  <span className="text-slate-500">[{new Date(log.created_at).toLocaleTimeString()}]</span>{' '}
                  {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </Card>

      {/* Back Link */}
      <Link
        to={`/projects/${project.id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Project
      </Link>
    </div>
  );
}
