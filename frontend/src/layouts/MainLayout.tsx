import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeSelector } from '../components/ThemeSelector';
import { Logo } from '../components/Logo';
import { LayoutDashboard, FileText, Server, Activity, FolderOpen, ChevronRight } from 'lucide-react';

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1419]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white dark:bg-[#1a1f2e] border-r border-gray-200 dark:border-gray-800 flex flex-col">
          {/* Logo */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-center">
            <Link to="/" className="block">
              <Logo pixelWidth={180} />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              <li>
                <Link
                  to="/"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/')
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <LayoutDashboard size={20} />
                  <span className="font-medium">Dashboard</span>
                </Link>
              </li>

              {/* Reports Section */}
              <li className="pt-4">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  <ChevronRight size={14} />
                  <span>Reports</span>
                </div>
                <ul className="space-y-1 mt-1">
                  <li>
                    <Link
                      to="/runs/by-job"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ml-2 ${
                        isActive('/runs/by-job')
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="font-medium">Run by Job</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/runs/by-endpoint"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ml-2 ${
                        isActive('/runs/by-endpoint')
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="font-medium">Run by Endpoint</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/runs"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ml-2 ${
                        isActive('/runs')
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="font-medium">Job Run Log</span>
                    </Link>
                  </li>
                </ul>
              </li>

              <li className="pt-4">
                <Link
                  to="/jobs"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/jobs')
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <FileText size={20} />
                  <span className="font-medium">Jobs</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/groups"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/groups')
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <FolderOpen size={20} />
                  <span className="font-medium">Job Groups</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/endpoints"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/endpoints')
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Server size={20} />
                  <span className="font-medium">Endpoints</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/agents"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/agents')
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Activity size={20} />
                  <span className="font-medium">Agents</span>
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-white dark:bg-[#1a1f2e] border-b border-gray-200 dark:border-gray-800">
            <div className="px-8 py-4 flex justify-end items-center">
              <div className="flex items-center gap-4">
                <ThemeSelector />
                <span className="text-sm text-gray-700 dark:text-gray-300">{user?.username}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
