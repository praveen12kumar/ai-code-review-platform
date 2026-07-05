import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button } from '../components/ui';
import type { Notification } from '../types';
import {
  Bell,
  CheckCircle,
  AlertCircle,
  FolderGit2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { formatRelativeTime } from '../lib/utils';
import { cn } from '../lib/utils';

const notificationIcons: Record<string, React.ElementType> = {
  REVIEW_COMPLETE: CheckCircle,
  REVIEW_FAILED: AlertCircle,
  PROJECT_SHARED: FolderGit2,
  SYSTEM: Bell,
};

const notificationColors: Record<string, string> = {
  REVIEW_COMPLETE: 'bg-emerald-100 text-emerald-600',
  REVIEW_FAILED: 'bg-red-100 text-red-600',
  PROJECT_SHARED: 'bg-blue-100 text-blue-600',
  SYSTEM: 'bg-slate-100 text-slate-600',
};

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  async function loadNotifications() {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setNotifications(data as Notification[]);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    setNotifications(notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n
    ));
  }

  async function markAllAsRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user?.id)
      .eq('is_read', false);

    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
            <Check className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      <Card padding="none">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || Bell;
              const colorClass = notificationColors[notification.type] || 'bg-slate-100 text-slate-600';

              return (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-slate-50 transition-colors',
                    !notification.is_read && 'bg-blue-50/50'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                        colorClass
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-500">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                        {notification.link_url && (
                          <a
                            href={notification.link_url}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-2 text-slate-400 hover:text-slate-600"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}