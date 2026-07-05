import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, Button, Badge } from '../components/ui';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, Review, Project, LlmUsage } from '../types';
import {
  Users,
  FolderGit2,
  BarChart3,
  DollarSign,
  Activity,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { formatRelativeTime, formatCurrency, getStatusColor } from '../lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function AdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reviews, setReviews] = useState<(Review & { project: Project })[]>([]);
  const [usage, setUsage] = useState<LlmUsage[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalReviews: 0,
    totalCost: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'ADMIN') {
      loadAdminData();
    }
  }, [profile]);

  async function loadAdminData() {
    try {
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (usersData) setUsers(usersData as UserProfile[]);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, project:projects(*)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (reviewsData) setReviews(reviewsData as (Review & { project: Project })[]);

      const { data: usageData } = await supabase
        .from('llm_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (usageData) setUsage(usageData as LlmUsage[]);

      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      const { count: totalProjects } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      const { count: totalReviews } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true });

      const { data: totalCostData } = await supabase
        .from('llm_usage')
        .select('cost_usd');

      const totalCost = totalCostData?.reduce((sum, u) => sum + Number(u.cost_usd), 0) || 0;

      setStats({
        totalUsers: totalUsers || 0,
        totalProjects: totalProjects || 0,
        totalReviews: totalReviews || 0,
        totalCost,
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (profile?.role !== 'ADMIN') {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  // Generate daily usage data (mock)
  const dailyUsage = [
    { date: 'Mon', reviews: 12, cost: 2.34 },
    { date: 'Tue', reviews: 18, cost: 3.56 },
    { date: 'Wed', reviews: 24, cost: 4.89 },
    { date: 'Thu', reviews: 15, cost: 2.78 },
    { date: 'Fri', reviews: 32, cost: 6.12 },
    { date: 'Sat', reviews: 8, cost: 1.45 },
    { date: 'Sun', reviews: 5, cost: 0.89 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">Platform overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <FolderGit2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Projects</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalProjects}</p>
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
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total LLM Cost</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalCost)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Daily Reviews" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="reviews"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Daily LLM Cost ($)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader title="Recent Users" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Role</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {formatRelativeTime(user.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader title="Recent Reviews" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Project</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Score</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {reviews.slice(0, 10).map((review) => (
                <tr key={review.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {review.project?.name || 'Unknown'}
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={getStatusColor(review.status)}>
                      {review.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {review.overall_score !== null ? (
                      <span className="font-bold text-slate-900">{review.overall_score}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {formatRelativeTime(review.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* LLM Usage */}
      <Card>
        <CardHeader title="Recent LLM Usage" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Agent</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Model</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Input</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Output</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usage.slice(0, 10).map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-3 px-4 font-medium text-slate-900 capitalize">{u.agent_name}</td>
                  <td className="py-3 px-4 text-slate-600">{u.model}</td>
                  <td className="py-3 px-4 text-right text-slate-600">{u.input_tokens.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-slate-600">{u.output_tokens.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-900">{formatCurrency(u.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}