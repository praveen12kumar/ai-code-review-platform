import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, Button, Input, Badge } from '../components/ui';
import {
  User,
  Lock,
  Bell,
  Github,
  Trash2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'danger'>('profile');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const handleProfileSubmit = async (data: ProfileFormData) => {
    setProfileSuccess(false);
    const { error } = await updateProfile({ name: data.name });
    if (!error) {
      setProfileSuccess(true);
    }
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setPasswordError(null);
    setPasswordSuccess(false);

    // Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || '',
      password: data.currentPassword,
    });

    if (signInError) {
      setPasswordError('Current password is incorrect');
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      passwordForm.reset();
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    const confirmed = prompt('Type DELETE to confirm:');
    if (confirmed !== 'DELETE') {
      return;
    }

    // In production, this would trigger a server-side deletion
    alert('Account deletion would be processed. This is a demo.');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'danger', label: 'Danger Zone', icon: AlertCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader title="Profile Information" subtitle="Update your account profile" />
          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-5">
            {profileSuccess && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
                <CheckCircle className="w-4 h-4" />
                Profile updated successfully
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <User className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <Button variant="outline" size="sm">
                  Change Avatar
                </Button>
                <p className="text-xs text-slate-500 mt-1">JPG, GIF or PNG. 1MB max.</p>
              </div>
            </div>
            <Input
              label="Full Name"
              error={profileForm.formState.errors.name?.message}
              {...profileForm.register('name')}
            />
            <Input
              label="Email Address"
              type="email"
              value={user?.email || ''}
              disabled
              helperText="Email cannot be changed"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Role
              </label>
              <Badge variant={profile?.role === 'ADMIN' ? 'info' : 'default'}>
                {profile?.role || 'USER'}
              </Badge>
            </div>
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              Save Changes
            </Button>
          </form>
        </Card>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Change Password" subtitle="Update your password" />
            <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-5">
              {passwordError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
                  <CheckCircle className="w-4 h-4" />
                  Password changed successfully
                </div>
              )}
              <Input
                label="Current Password"
                type="password"
                error={passwordForm.formState.errors.currentPassword?.message}
                {...passwordForm.register('currentPassword')}
              />
              <Input
                label="New Password"
                type="password"
                helperText="At least 8 characters"
                error={passwordForm.formState.errors.newPassword?.message}
                {...passwordForm.register('newPassword')}
              />
              <Input
                label="Confirm New Password"
                type="password"
                error={passwordForm.formState.errors.confirmPassword?.message}
                {...passwordForm.register('confirmPassword')}
              />
              <Button type="submit" loading={passwordForm.formState.isSubmitting}>
                Update Password
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Connected Accounts" subtitle="Manage your connected services" />
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <Github className="w-6 h-6 text-slate-700" />
                  <div>
                    <p className="font-medium text-slate-900">GitHub</p>
                    <p className="text-sm text-slate-500">
                      Connect for private repository access
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Connect
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader title="Email Notifications" subtitle="Manage your email preferences" />
          <div className="space-y-4">
            {['review_complete', 'review_failed', 'project_shared'].map((type) => (
              <label key={type} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
                <div>
                  <p className="font-medium text-slate-900 capitalize">
                    {type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-slate-500">
                    Receive notifications when a {type.replace(/_/g, ' ')} event occurs
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="space-y-6">
          <Card className="border-red-200">
            <CardHeader
              title="Export Data"
              subtitle="Download all your data"
            />
            <Button variant="outline" className="gap-2">
              <User className="w-4 h-4" />
              Export My Data
            </Button>
          </Card>

          <Card className="border-red-200">
            <CardHeader
              title="Delete Account"
              subtitle="Permanently delete your account and all data"
            />
            <p className="text-sm text-slate-600 mb-4">
              Once you delete your account, there is no going back. Please be certain.
              All your projects, reviews, and data will be permanently deleted.
            </p>
            <Button variant="danger" className="gap-2" onClick={handleDeleteAccount}>
              <Trash2 className="w-4 h-4" />
              Delete My Account
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}