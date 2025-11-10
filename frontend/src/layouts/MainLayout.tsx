import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeSelector } from '../components/ThemeSelector';
import { LayoutDashboard, FileText, Server, Activity, ChevronRight } from 'lucide-react';

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
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Crontopus</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              <li>
                <Link
                  to="/"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/')
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <LayoutDashboard size={20} />
                  <span className="font-medium">Dashboard</span>
                </Link>
              </li>

              {/* Reports Section */}
              <li className="pt-4">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                  Reports
                </div>
                <ul className="space-y-1 mt-1">
                  <li>
                    <Link
                      to="/runs"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive('/runs')
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <ChevronRight size={16} className="ml-1" />
                      <span className="font-medium">Job Runs</span>
                    </Link>
                  </li>
                </ul>
              </li>

              <li className="pt-4">
                <Link
                  to="/jobs"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/jobs')
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <FileText size={20} />
                  <span className="font-medium">Jobs</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/endpoints"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/endpoints')
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
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
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
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
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
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
