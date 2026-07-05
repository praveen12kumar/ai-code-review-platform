import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, Button, Badge } from '../components/ui';
import type { Project, Review } from '../types';
import {
  Plus,
  FolderGit2,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { formatRelativeTime, getStatusColor, getScoreColor } from '../lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface ProjectWithReviews extends Project {
  reviews: Review[];
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<ProjectWithReviews[]>([]);
  const [recentReviews, setRecentReviews] = useState<(Review & { project: Project })[]>([]);
  const [stats, setStats] = useState({
    totalReviews: 0,
    completedReviews: 0,
    averageScore: 0,
    projectsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch projects with reviews
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*, reviews(*)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (projectsData) {
        setProjects(projectsData as ProjectWithReviews[]);
      }

      // Fetch recent reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, project:projects(*)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (reviewsData) {
        setRecentReviews(reviewsData as (Review & { project: Project })[]);
      }

      // Calculate stats
      const { count: totalReviews } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true });

      const { data: completedData } = await supabase
        .from('reviews')
        .select('overall_score')
        .eq('status', 'COMPLETED')
        .not('overall_score', 'is', null);

      const completedReviews = completedData?.length || 0;
      const averageScore =
        completedData && completedData.length > 0
          ? Math.round(
              completedData.reduce((sum, r) => sum + (r.overall_score || 0), 0) /
                completedData.length
            )
          : 0;

      const { count: projectsCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      setStats({
        totalReviews: totalReviews || 0,
        completedReviews,
        averageScore,
        projectsCount: projectsCount || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusData = [
    { name: 'Completed', value: stats.completedReviews, color: '#10b981' },
    {
      name: 'Other',
      value: stats.totalReviews - stats.completedReviews,
      color: '#94a3b8',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {profile?.name?.split(' ')[0] || 'Developer'}
          </h1>
          <p className="text-slate-500 mt-1">
            Here's an overview of your code reviews
          </p>
        </div>
        <Link to="/projects/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <FolderGit2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Projects</p>
              <p className="text-2xl font-bold text-slate-900">{stats.projectsCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Reviews Completed</p>
              <p className="text-2xl font-bold text-slate-900">{stats.completedReviews}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avg Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>
                {stats.averageScore}
              </p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Reviews</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalReviews}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent Projects"
              action={
                <Link to="/projects" className="text-sm text-slate-600 hover:text-slate-900">
                  View all
                </Link>
              }
            />
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <FolderGit2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">No projects yet</p>
                <Link to="/projects/new">
                  <Button variant="outline" size="sm">
                    Create your first project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                        <FolderGit2 className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{project.name}</p>
                        <p className="text-sm text-slate-500">
                          {project.reviews?.length || 0} reviews
                        </p>
                      </div>
                    </div>
                    <Link to={`/projects/${project.id}`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Review Status Chart */}
        <div>
          <Card>
            <CardHeader title="Review Status" />
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Reviews */}
      <Card>
        <CardHeader
          title="Recent Reviews"
          action={
            <Link to="/projects" className="text-sm text-slate-600 hover:text-slate-900">
              View all
            </Link>
          }
        />
        {recentReviews.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No reviews yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Project
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Score
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">
                    Created
                  </th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {recentReviews.map((review) => (
                  <tr key={review.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {review.project?.name || 'Unknown'}
                      </p>
                    </td>
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
    </div>
  );
}