import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs';

export const JobNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    namespace: 'production',
    schedule: '',
    command: '',
    args: '',
    env: '',
    enabled: true,
    paused: false,
    timezone: '',
    labels: '',
  });

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Job</h2>
        <button
          onClick={() => navigate('/jobs')}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          ← Back to jobs
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Job Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Job Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="backup-database"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Alphanumeric and hyphens only</p>
          </div>

          {/* Namespace */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Environment *
            </label>
            <select
              value={formData.namespace}
              onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </select>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Schedule (Cron Expression) *
          </label>
          <input
            type="text"
            required
            value={formData.schedule}
            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0 2 * * *"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Examples: <code>0 2 * * *</code> (daily at 2am), <code>*/5 * * * *</code> (every 5 minutes)
          </p>
        </div>

        {/* Command */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Command *
          </label>
          <input
            type="text"
            required
            value={formData.command}
            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="/usr/local/bin/backup.sh"
          />
        </div>

        {/* Arguments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Arguments (comma-separated)
          </label>
          <input
            type="text"
            value={formData.args}
            onChange={(e) => setFormData({ ...formData, args: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="--full, --compress"
          />
        </div>

        {/* Environment Variables */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Environment Variables (one per line)
          </label>
          <textarea
            value={formData.env}
            onChange={(e) => setFormData({ ...formData, env: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="DATABASE_URL=postgres://...&#10;AWS_REGION=us-east-1"
          />
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Timezone
          </label>
          <input
            type="text"
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="America/New_York"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Optional. Defaults to UTC</p>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Labels (one per line)
          </label>
          <textarea
            value={formData.labels}
            onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="team=backend&#10;priority=high"
          />
        </div>

        {/* Status toggles */}
        <div className="flex space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="mr-2 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.paused}
              onChange={(e) => setFormData({ ...formData, paused: e.target.checked })}
              className="mr-2 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Paused</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  );
};
