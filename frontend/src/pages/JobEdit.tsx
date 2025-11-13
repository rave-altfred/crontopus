import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobsApi, type JobDetailResponse } from '../api/jobs';

export const JobEdit = () => {
  const navigate = useNavigate();
  const { namespace, jobName } = useParams<{ namespace: string; jobName: string }>();
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  
  const [formData, setFormData] = useState({
    schedule: '',
    command: '',
    args: '',
    env: '',
    enabled: true,
    paused: false,
    timezone: '',
    labels: '',
  });

  // Load existing job data
  useEffect(() => {
    if (!namespace || !jobName) return;

    jobsApi
      .getByName(namespace, jobName)
      .then((jobData) => {
        setJob(jobData);
        const manifest = jobData.manifest;
        
        // Pre-fill form with existing data
        setFormData({
          schedule: manifest.spec.schedule,
          command: manifest.spec.command,
          args: manifest.spec.args ? manifest.spec.args.join(', ') : '',
          env: manifest.spec.env
            ? Object.entries(manifest.spec.env)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n')
            : '',
          enabled: manifest.spec.enabled !== false,
          paused: manifest.spec.paused || false,
          timezone: manifest.spec.timezone || '',
          labels: manifest.metadata.labels
            ? Object.entries(manifest.metadata.labels)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n')
            : '',
        });
      })
      .catch((err) => {
        console.error('Failed to load job:', err);
        setError(err.response?.data?.detail || 'Failed to load job');
      })
      .finally(() => setLoadingJob(false));
  }, [namespace, jobName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namespace || !jobName) return;

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
        schedule: formData.schedule,
        command: formData.command,
        args,
        env,
        enabled: formData.enabled,
        paused: formData.paused,
        timezone: formData.timezone || undefined,
        labels,
      };

      await jobsApi.update(namespace, jobName, payload);
      
      // Navigate back to job detail
      navigate(`/jobs/${namespace}/${jobName}.yaml`);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to update job');
    } finally {
      setLoading(false);
    }
  };

  if (loadingJob) {
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
  }

  if (error && !job) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h3 className="text-red-800 dark:text-red-400 font-medium">Error loading job</h3>
        <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
        <button
          onClick={() => navigate('/jobs')}
          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm mt-2 inline-block"
        >
          ← Back to jobs
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Job: {job?.manifest.metadata.name}
        </h2>
        <button
          onClick={() => navigate(`/jobs/${namespace}/${jobName}.yaml`)}
          className="text-sm text-gray-600 dark:text-[#6272a4] hover:text-gray-900 dark:hover:text-white"
        >
          ← Back to job
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded">
        <p className="text-sm">
          💡 Editing will commit changes to Git repository. This action will be tracked in Git history.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#44475a] rounded-lg shadow p-6 space-y-6">
        {/* Read-only info */}
        <div className="grid grid-cols-2 gap-6 pb-4 border-b border-gray-200 dark:border-[#6272a4]">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
              Job Name
            </label>
            <input
              type="text"
              value={job?.manifest.metadata.name || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-[#44475a] text-gray-600 dark:text-[#6272a4]"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4]">Cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
              Group
            </label>
            <input
              type="text"
              value={namespace || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-[#44475a] text-gray-600 dark:text-[#6272a4]"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4]">Cannot be changed</p>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
            Schedule (Cron Expression) *
          </label>
          <input
            type="text"
            required
            value={formData.schedule}
            onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0 2 * * *"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4]">
            Examples: <code>0 2 * * *</code> (daily at 2am), <code>*/5 * * * *</code> (every 5 minutes)
          </p>
        </div>

        {/* Command */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
            Command *
          </label>
          <input
            type="text"
            required
            value={formData.command}
            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="/usr/local/bin/backup.sh"
          />
        </div>

        {/* Arguments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
            Arguments (comma-separated)
          </label>
          <input
            type="text"
            value={formData.args}
            onChange={(e) => setFormData({ ...formData, args: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="--full, --compress"
          />
        </div>

        {/* Environment Variables */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
            Environment Variables (one per line)
          </label>
          <textarea
            value={formData.env}
            onChange={(e) => setFormData({ ...formData, env: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="DATABASE_URL=postgres://...&#10;AWS_REGION=us-east-1"
          />
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
            Timezone
          </label>
          <input
            type="text"
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="America/New_York"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-[#6272a4]">Optional. Defaults to UTC</p>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-2">
            Labels (one per line)
          </label>
          <textarea
            value={formData.labels}
            onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#44475a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <span className="text-sm text-gray-700 dark:text-[#f8f8f2]">Enabled</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.paused}
              onChange={(e) => setFormData({ ...formData, paused: e.target.checked })}
              className="mr-2 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-[#f8f8f2]">Paused</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-[#6272a4]">
          <button
            type="button"
            onClick={() => navigate(`/jobs/${namespace}/${jobName}.yaml`)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
