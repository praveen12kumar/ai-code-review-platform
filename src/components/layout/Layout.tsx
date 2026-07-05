import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui';
import {
  Code2,
  LayoutDashboard,
  FolderGit2,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Shield,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderGit2 },
  ];

  if (profile?.role === 'ADMIN') {
    navigation.push({ name: 'Admin', href: '/admin', icon: Shield });
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
      >
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">CodeReview AI</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-slate-200">
          <div className="flex items-center gap-2 p-4 border-b border-slate-200">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">CodeReview AI</span>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {profile?.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <Link
                to="/settings"
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-700 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 ml-auto">
              <Link
                to="/notifications"
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Link>

              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">
                        {profile?.name}
                      </p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}