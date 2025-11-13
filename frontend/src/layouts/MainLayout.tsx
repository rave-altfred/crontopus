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
    <div className="min-h-screen bg-gray-50 dark:bg-[#282a36]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white dark:bg-[#21222c] border-r border-gray-200 dark:border-[#44475a] flex flex-col">
          {/* Logo */}
          <div className="py-6 px-4 border-b border-gray-200 dark:border-[#44475a] flex justify-center">
            <Link to="/" className="block">
              <Logo size="md" />
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
                      ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                      : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
                          ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                          : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
                          ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                          : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
                          ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                          : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
                      ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                      : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
                      ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                      : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
                      ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                      : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
                      ? 'bg-brand-50 dark:bg-[#44475a] text-brand-600 dark:text-[#bd93f9]'
                      : 'text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-100 dark:hover:bg-[#44475a]/50'
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
          <header className="bg-white dark:bg-[#21222c] border-b border-gray-200 dark:border-[#44475a]">
            <div className="px-8 py-4 flex justify-end items-center">
              <div className="flex items-center gap-4">
                <ThemeSelector />
                <span className="text-sm text-gray-700 dark:text-[#f8f8f2]">{user?.username}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-brand-600 dark:text-[#ff79c6] hover:text-brand-800 dark:hover:text-[#bd93f9] font-medium"
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
