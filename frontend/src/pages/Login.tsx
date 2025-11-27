import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ username, password });
      navigate('/');
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1e1f29] py-12 px-4 sm:px-6 lg:px-8 bg-grid-pattern">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-[#282a36] p-8 rounded border border-gray-200 dark:border-[#44475a] shadow-lg">
        <div className="flex flex-col items-center">
          <Logo size="lg" className="mb-6" />
          <h2 className="mt-2 text-center text-2xl font-bold text-gray-900 dark:text-white font-mono uppercase tracking-wide">
            System Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-[#6272a4] font-mono">
            Enter credentials to access control plane
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-200 font-mono">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] placeholder-gray-400 dark:placeholder-gray-600 text-gray-900 dark:text-white bg-white dark:bg-[#21222c] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="user@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] placeholder-gray-400 dark:placeholder-gray-600 text-gray-900 dark:text-white bg-white dark:bg-[#21222c] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-mono font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
            </button>
          </div>

          <div className="text-center pt-4 border-t border-gray-200 dark:border-[#44475a]">
            <p className="text-xs text-gray-600 dark:text-[#6272a4] font-mono">
              NO ACCOUNT?{' '}
              <Link
                to="/register"
                className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 uppercase"
              >
                REGISTER NEW USER
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
