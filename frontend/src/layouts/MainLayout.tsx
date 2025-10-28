import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Crontopus</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow p-4">
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    to="/runs"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                  >
                    Job Runs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/agents"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                  >
                    Agents
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
