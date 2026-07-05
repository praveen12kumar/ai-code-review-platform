import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, Button, Badge } from '../components/ui';
import type { Review, AgentReport, Project, Finding } from '../types';
import { AGENTS, AGENT_SCORE_WEIGHTS } from '../types';
import {
  ArrowLeft,
  Download,
  Share2,
  CheckCircle,
  AlertTriangle,
  Shield,
  Network,
  Zap,
  Sparkles,
  FlaskConical,
  FileText,
  FileSearch,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { formatRelativeTime, getScoreColor, getSeverityColor, cn } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const agentIcons: Record<string, React.ElementType> = {
  architecture: Network,
  security: Shield,
  performance: Zap,
  quality: Sparkles,
  testing: FlaskConical,
  manager: FileText,
};

export function ReviewReportPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [review, setReview] = useState<Review | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [agentReports, setAgentReports] = useState<AgentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');

  useEffect(() => {
    if (id) {
      loadReport(id);
    }
  }, [id]);

  async function loadReport(reviewId: string) {
    try {
      const { data: reviewData, error } = await supabase
        .from('reviews')
        .select('*, project:projects(*)')
        .eq('id', reviewId)
        .maybeSingle();

      if (error) throw error;
      if (!reviewData) return;

      setReview(reviewData as Review);
      setProject((reviewData as any).project as Project);

      const { data: reportsData } = await supabase
        .from('agent_reports')
        .select('*')
        .eq('review_id', reviewId);

      if (reportsData) {
        setAgentReports(reportsData as AgentReport[]);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  }

  const allFindings = agentReports.flatMap((report) =>
    (report.findings || []).map((finding) => ({
      ...finding,
      agentName: report.agent_name,
    }))
  );

  const filteredFindings = allFindings.filter((finding) => {
    if (filterSeverity !== 'all' && finding.severity !== filterSeverity) return false;
    if (filterAgent !== 'all' && finding.agentName !== filterAgent) return false;
    return true;
  });

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedFindings = [...filteredFindings].sort(
    (a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]
  );

  const agentScores = AGENTS.map((agent) => {
    const report = agentReports.find((r) => r.agent_name === agent.name);
    return {
      agent: agent.displayName,
      score: report?.score || 0,
      color: agent.color,
    };
  });

  const radarData = agentScores.map((a) => ({
    subject: a.agent,
    score: a.score,
    fullMark: 100,
  }));

  const toggleFinding = (id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
        <FileSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Report not found</p>
        <Link to="/projects">
          <Button variant="outline" className="mt-4">
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to={`/projects/${project.id}`} className="hover:text-slate-700">
              {project.name}
            </Link>
            <span>/</span>
            <span>Report</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Code Review Report</h1>
          <p className="text-slate-500 mt-1">
            Completed {formatRelativeTime(review.completed_at || review.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 no-print">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button size="sm" className="gap-2 no-print" onClick={() => window.print()}>
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <Card padding="lg">
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div
              className={cn(
                'w-32 h-32 rounded-2xl flex flex-col items-center justify-center',
                review.overall_score && review.overall_score >= 80
                  ? 'bg-emerald-100'
                  : review.overall_score && review.overall_score >= 60
                  ? 'bg-amber-100'
                  : 'bg-red-100'
              )}
            >
              <span
                className={cn(
                  'text-5xl font-bold',
                  getScoreColor(review.overall_score || 0)
                )}
              >
                {review.overall_score}
              </span>
              <span className="text-sm text-slate-500 mt-1">Overall Score</span>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Agent Scores</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentScores} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="agent" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="w-64">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">Profile</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>

      {/* Manager Agent Consolidated Report */}
      {(() => {
        const managerReport = agentReports.find((r) => r.agent_name === 'manager');
        if (!managerReport) return null;
        const managerFindings = (managerReport.findings || []) as Finding[];
        const managerRecs = (managerReport.recommendations || []) as string[];

        return (
          <Card padding="lg" className="border-sky-200 bg-sky-50/40">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-sky-100">
                <FileText className="w-6 h-6 text-sky-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Manager Report — Consolidated Findings
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Top-priority issues synthesized across all specialist agents, ranked by severity and impact.
                </p>
              </div>
              {managerReport.score !== null && managerReport.score !== undefined && (
                <div className="text-right">
                  <div className="text-3xl font-bold text-slate-900">{managerReport.score}</div>
                  <div className="text-xs text-slate-500">Overall</div>
                </div>
              )}
            </div>

            {review.summary && (
              <div className="rounded-lg bg-white border border-sky-200 p-4 mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Executive Summary</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{review.summary}</p>
              </div>
            )}

            {managerFindings.length > 0 && (
              <div className="space-y-2 mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Top Priorities</h3>
                {managerFindings.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-lg bg-white border border-slate-200 p-3 flex items-start gap-3"
                  >
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium flex-shrink-0',
                        f.severity === 'critical' && 'bg-red-100 text-red-700',
                        f.severity === 'high' && 'bg-orange-100 text-orange-700',
                        f.severity === 'medium' && 'bg-amber-100 text-amber-700',
                        f.severity === 'low' && 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {f.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{f.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {f.file}:{f.line_start} — {f.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {managerRecs.length > 0 && (
              <div className="rounded-lg bg-white border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Recommended Action Plan
                </h3>
                <ol className="space-y-2">
                  {managerRecs.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Agent Details */}
      {AGENTS.map((agent) => {
        const report = agentReports.find((r) => r.agent_name === agent.name);
        if (!report) return null;
        // Skip the manager here — it's rendered in its own consolidated section above.
        if (agent.name === 'manager') return null;

        const Icon = agentIcons[agent.name] || FileSearch;
        const agentFindings = (report.findings || []) as Finding[];
        const criticalCount = agentFindings.filter((f) => f.severity === 'critical').length;
        const highCount = agentFindings.filter((f) => f.severity === 'high').length;

        return (
          <Card key={agent.name}>
            <div className="flex items-start gap-4 mb-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${agent.color}15` }}
              >
                <Icon className="w-6 h-6" style={{ color: agent.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">{agent.displayName}</h3>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`text-2xl font-bold ${getScoreColor(report.score || 0)}`}>
                        {report.score}
                      </span>
                      <span className="text-slate-400 ml-1">/ 100</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-1">{agent.description}</p>
              </div>
            </div>

            {/* Severity Summary */}
            <div className="flex items-center gap-4 mb-4">
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                {criticalCount} Critical
              </span>
              <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium">
                {highCount} High
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                {agentFindings.filter((f) => f.severity === 'medium').length} Medium
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                {agentFindings.filter((f) => f.severity === 'low').length} Low
              </span>
            </div>

            {/* Recommendations */}
            {(report.recommendations || []).length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-slate-900 mb-2">Key Recommendations</h4>
                <ul className="space-y-2">
                  {(report.recommendations || []).slice(0, 3).map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}

      {/* All Findings */}
      <Card padding="none">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">All Findings</h3>
              <p className="text-sm text-slate-500">{sortedFindings.length} issues found</p>
            </div>
            <div className="flex items-center gap-3 no-print">
              <select
n                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="all">All Agents</option>
                {AGENTS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {sortedFindings.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-500">No findings match your filters</p>
            </div>
          ) : (
            sortedFindings.map((finding, index) => {
              const isExpanded = expandedFindings.has(finding.id);
              const agent = AGENTS.find((a) => a.name === finding.agentName);

              return (
                <div key={finding.id || index} className="p-4 hover:bg-slate-50">
                  <button
                    onClick={() => toggleFinding(finding.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                        style={{ backgroundColor: `${agent?.color}15`, color: agent?.color }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getSeverityColor(finding.severity)} size="sm">
                            {finding.severity}
                          </Badge>
                          <Badge variant="default" size="sm">
                            {agent?.displayName}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {finding.confidence}% confidence
                          </span>
                        </div>
                        <p className="font-medium text-slate-900">{finding.title}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                          <code className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                            {finding.file}
                          </code>
                          <span>
                            Lines {finding.line_start}-{finding.line_end}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 ml-11 space-y-4">
                      {/* Evidence */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-1">Evidence</h4>
                        <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-slate-300 overflow-x-auto">
                          <pre>{finding.evidence}</pre>
                        </div>
                      </div>

                      {/* Explanation */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-1">Explanation</h4>
                        <p className="text-sm text-slate-600">{finding.explanation}</p>
                      </div>

                      {/* Recommendation */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-1">Recommendation</h4>
                        <p className="text-sm text-slate-600">{finding.recommendation}</p>
                      </div>

                      {/* Suggested Fix */}
                      {finding.suggested_fix && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-1">Suggested Fix</h4>
                          <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-emerald-400 overflow-x-auto">
                            <pre>{finding.suggested_fix}</pre>
                          </div>
                        </div>
                      )}

                      {/* CWE */}
                      {finding.cwe && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <ExternalLink className="w-4 h-4" />
                          <a
                            href={`https://cwe.mitre.org/data/definitions/${finding.cwe.replace('CWE-', '')}.html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-slate-700"
                          >
                            {finding.cwe}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Coverage Disclosure */}
      {review.coverage && (
        <Card>
          <CardHeader title="Analysis Coverage" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">
                {(review.coverage as any).files_analyzed || 0}
              </p>
              <p className="text-sm text-slate-500">Files Analyzed</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">
                {(review.coverage as any).files_total || 0}
              </p>
              <p className="text-sm text-slate-500">Total Files</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">
                {(review.coverage as any).lines_analyzed || 0}
              </p>
              <p className="text-sm text-slate-500">Lines Analyzed</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">
                {(review.coverage as any).files_skipped || 0}
              </p>
              <p className="text-sm text-slate-500">Files Skipped</p>
            </div>
          </div>
        </Card>
      )}

      {/* Back Link */}
      <Link
        to={`/projects/${project.id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 no-print"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Project
      </Link>
    </div>
  );
}