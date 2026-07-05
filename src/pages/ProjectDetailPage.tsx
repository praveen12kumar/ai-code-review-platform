import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, Button, Badge } from '../components/ui';
import type { Project, Review } from '../types';
import {
  Github,
  FileArchive,
  Play,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { formatRelativeTime, getStatusColor, getScoreColor } from '../lib/utils';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingReview, setStartingReview] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject(id);
    }
  }, [id]);

  async function loadProject(projectId: string) {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .is('deleted_at', null)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!projectData) {
        navigate('/projects');
        return;
      }
      setProject(projectData as Project);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (reviewsData) {
        setReviews(reviewsData as Review[]);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startReview() {
    if (!project) return;
    setStartingReview(true);

    try {
      const { data: review, error } = await supabase
        .from('reviews')
        .insert({
          project_id: project.id,
          status: 'QUEUED',
          branch: project.default_branch,
        })
        .select()
        .single();

      if (error) throw error;

      // Fire-and-forget: the edge function runs the review in the background.
      // We navigate to the progress page immediately; the user does NOT need
      // to stay on the screen — the review continues server-side.
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ review_id: review.id, project_id: project.id }),
      }).catch((err) => console.error('Failed to trigger review:', err));

      navigate(`/reviews/${review.id}`);
    } catch (error) {
      console.error('Error starting review:', error);
    } finally {
      setStartingReview(false);
    }
  }

  async function deleteProject() {
    if (!project) return;
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', project.id);
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const activeReviews = reviews.filter((r) =>
    !['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status)
  );
  const completedReviews = reviews.filter((r) => r.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
            {project.source_type === 'GITHUB' ? (
              <Github className="w-6 h-6 text-slate-600" />
            ) : (
              <FileArchive className="w-6 h-6 text-slate-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <Badge variant="info">
                {project.source_type === 'GITHUB' ? 'GitHub' : 'Upload'}
              </Badge>
            </div>
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mt-1"
              >
                {project.github_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {project.description && (
              <p className="text-slate-500 mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={deleteProject}>
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
          <Button
            className="gap-2"
            onClick={startReview}
            loading={startingReview}
            disabled={activeReviews.length > 0}
          >
            <Play className="w-4 h-4" />
            Start Review
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Reviews</p>
              <p className="text-xl font-bold text-slate-900">{reviews.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-xl font-bold text-slate-900">{completedReviews.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">In Progress</p>
              <p className="text-xl font-bold text-slate-900">{activeReviews.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Score</p>
              <p className={`text-xl font-bold ${getScoreColor(
                completedReviews.length > 0
                  ? Math.round(
                      completedReviews.reduce((sum, r) => sum + (r.overall_score || 0), 0) /
                        completedReviews.length
                    )
                  : 0
              )}`}>
                {completedReviews.length > 0
                  ? Math.round(
                      completedReviews.reduce((sum, r) => sum + (r.overall_score || 0), 0) /
                        completedReviews.length
                    )
                  : '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Reviews */}
      {activeReviews.length > 0 && (
        <Card>
          <CardHeader title="Active Reviews" />
          <div className="space-y-3">
            {activeReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{review.status}</p>
                    <p className="text-sm text-slate-500">
                      Started {formatRelativeTime(review.created_at)}
                    </p>
                  </div>
                </div>
                <Link to={`/reviews/${review.id}`}>
                  <Button variant="outline" size="sm">
                    View Progress
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Review History */}
      <Card>
        <CardHeader
          title="Review History"
          subtitle={`${reviews.length} total reviews`}
        />
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No reviews yet</p>
            <Button onClick={startReview} loading={startingReview}>
              Start your first review
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Score
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Branch
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Created
                  </th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(review.status)}>
                        {review.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {review.overall_score !== null ? (
                        <span className={`font-bold ${getScoreColor(review.overall_score)}`}>
                          {review.overall_score}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {review.branch || project.default_branch}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {formatRelativeTime(review.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/reviews/${review.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Back Link */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </Link>
    </div>
  );
}