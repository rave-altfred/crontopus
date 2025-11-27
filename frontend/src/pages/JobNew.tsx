import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';
import { namespacesApi, type Namespace } from '../api/namespaces';

export const JobNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loadingNamespaces, setLoadingNamespaces] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    namespace: 'default',
    schedule: '',
    command: '',
    args: '',
    env: '',
    enabled: true,
    paused: false,
    timezone: '',
    labels: '',
  });

  useEffect(() => {
    loadNamespaces();
  }, []);

  const loadNamespaces = async () => {
    try {
      setLoadingNamespaces(true);
      const data = await namespacesApi.list();
      // Filter out discovered namespace (system-managed)
      const userNamespaces = data.filter(ns => ns.name !== 'discovered');
      setNamespaces(userNamespaces);
    } catch (err) {
      console.error('Failed to load namespaces:', err);
    } finally {
      setLoadingNamespaces(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Parse args (comma-separated)
      const args = formData.args
        ? formData.args.split(',').map(arg => arg.trim()).filter(Boolean)
        : undefined;

      // Parse env (key=value pairs, one per line)
      const env = formData.env
        ? Object.fromEntries(
            formData.env
              .split('\n')
              .map(line => line.trim())
              .filter(Boolean)
              .map(line => {
                const [key, ...values] = line.split('=');
                return [key.trim(), values.join('=').trim()];
              })
          )
        : undefined;

      // Parse labels (key=value pairs, one per line)
      const labels = formData.labels
        ? Object.fromEntries(
            formData.labels
              .split('\n')
              .map(line => line.trim())
              .filter(Boolean)
              .map(line => {
                const [key, ...values] = line.split('=');
                return [key.trim(), values.join('=').trim()];
              })
          )
        : undefined;

      const payload = {
        name: formData.name,
        namespace: formData.namespace,
        schedule: formData.schedule,
        command: formData.command,
        args,
        env,
        enabled: formData.enabled,
        paused: formData.paused,
        timezone: formData.timezone || undefined,
        labels,
      };

      await jobsApi.create(payload);
      
      // Navigate to jobs list
      navigate('/jobs');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-mono uppercase">Create New Job</h2>
        <button
          onClick={() => navigate('/jobs')}
          className="text-xs font-mono font-bold text-gray-600 dark:text-[#6272a4] hover:text-gray-900 dark:hover:text-white uppercase tracking-wider"
        >
          ← Back to jobs
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-red-700 dark:text-red-400 font-mono text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Job Name */}
          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Job Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              placeholder="backup-database"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4] font-mono">Alphanumeric and hyphens only</p>
          </div>

          {/* Namespace */}
          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Group *
            </label>
            <div className="flex gap-2">
              <select
                value={formData.namespace}
                onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                disabled={loadingNamespaces}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                {loadingNamespaces ? (
                  <option>LOADING...</option>
                ) : (
                  namespaces.map(ns => (
                    <option key={ns.name} value={ns.name}>
                      {ns.name.toUpperCase()}{ns.is_system ? ' (SYSTEM)' : ''}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => navigate('/groups')}
                className="px-3 py-2 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] text-xs font-mono font-bold uppercase whitespace-nowrap transition-colors"
              >
                + Group
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4] font-mono">Select group or create a new one</p>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
            Schedule (Cron Expression) *
          </label>
          <input
            type="text"
            required
            value={formData.schedule}
            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            placeholder="0 2 * * *"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4] font-mono">
            Examples: <code>0 2 * * *</code> (daily at 2am), <code>*/5 * * * *</code> (every 5 minutes)
          </p>
        </div>

        {/* Command */}
        <div>
          <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
            Command *
          </label>
          <input
            type="text"
            required
            value={formData.command}
            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            placeholder="/usr/local/bin/backup.sh"
          />
        </div>

        {/* Arguments */}
        <div>
          <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
            Arguments (comma-separated)
          </label>
          <input
            type="text"
            value={formData.args}
            onChange={(e) => setFormData({ ...formData, args: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            placeholder="--full, --compress"
          />
        </div>

        {/* Environment Variables */}
        <div>
          <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
            Environment Variables (one per line)
          </label>
          <textarea
            value={formData.env}
            onChange={(e) => setFormData({ ...formData, env: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            rows={4}
            placeholder="DATABASE_URL=postgres://...&#10;AWS_REGION=us-east-1"
          />
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
            Timezone
          </label>
          <input
            type="text"
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            placeholder="America/New_York"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4] font-mono">Optional. Defaults to UTC</p>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
            Labels (one per line)
          </label>
          <textarea
            value={formData.labels}
            onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            rows={3}
            placeholder="team=backend&#10;priority=high"
          />
        </div>

        {/* Status toggles */}
        <div className="flex space-x-6 border border-gray-200 dark:border-[#44475a] p-4 bg-gray-50 dark:bg-[#21222c]">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="mr-2 rounded border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] focus:ring-blue-500"
            />
            <span className="text-xs font-mono font-bold text-gray-700 dark:text-[#f8f8f2] uppercase">Enabled</span>
          </label>
          
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.paused}
              onChange={(e) => setFormData({ ...formData, paused: e.target.checked })}
              className="mr-2 rounded border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] focus:ring-blue-500"
            />
            <span className="text-xs font-mono font-bold text-gray-700 dark:text-[#f8f8f2] uppercase">Paused</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-[#44475a]">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="px-4 py-2 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] text-xs font-mono font-bold uppercase transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  );
};
