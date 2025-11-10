import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { jobsApi, type JobDetailResponse, type JobEndpoint } from '../api/jobs';
import { runsApi, type JobRun } from '../api/runs';
import { ManifestViewer } from '../components/ManifestViewer';

export const JobDetail = () => {
  const navigate = useNavigate();
  const { '*': jobPath } = useParams();
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [endpoints, setEndpoints] = useState<JobEndpoint[]>([]);

  useEffect(() => {
    if (!jobPath) return;

    const namespace = jobPath?.split('/')[0] || '';
    const jobFileName = jobPath?.split('/').pop() || '';
    const jobName = jobFileName.replace(/\.(yaml|yml)$/, '');

    // Fetch job details
    jobsApi.get(jobPath)
      .then(async (jobData) => {
        setJob(jobData);
        
        // Fetch endpoints running this job
        try {
          const endpointsData = await jobsApi.getEndpoints(namespace, jobName);
          setEndpoints(endpointsData);
        } catch (err) {
          console.error('Failed to load endpoints:', err);
        }
        
        // Try to fetch runs, but don't fail if endpoint doesn't exist
        return runsApi.listByJob(jobName).catch(() => []);
      })
      .then((runsData) => {
        setRuns(runsData || []);
      })
      .catch((err) => {
        console.error('Failed to load job:', err);
        setError(err.response?.data?.detail || 'Failed to load job');
      })
      .finally(() => setLoading(false));
  }, [jobPath]);

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (error || !job) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h3 className="text-red-800 dark:text-red-400 font-medium">Error loading job</h3>
        <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error || 'Job not found'}</p>
        <Link to="/jobs" className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm mt-2 inline-block">
          ← Back to jobs
        </Link>
      </div>
    );
  }

  const { manifest } = job;
  const gitUrl = `https://git.crontopus.com/crontopus/job-manifests/src/branch/main/${jobPath}`;
  
  // Extract namespace and job name from path (e.g., "production/backup-db.yaml")
  const namespace = jobPath?.split('/')[0] || '';
  const jobFileName = jobPath?.split('/').pop() || '';
  const jobName = jobFileName.replace(/\.(yaml|yml)$/, '');

  const handleDelete = async () => {
    if (!namespace || !jobName) return;

    setDeleting(true);
    try {
      await jobsApi.delete(namespace, jobName);
      // Navigate back to jobs list
      navigate('/jobs');
    } catch (err: any) {
      console.error('Failed to delete job:', err);
      setError(err.response?.data?.detail || 'Failed to delete job');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleUnassignEndpoint = async (endpointId: string) => {
    if (!confirm('Unassign this endpoint from the job?')) return;

    try {
      await jobsApi.unassignFromEndpoint(namespace, jobName, endpointId);
      
      // Reload endpoints for this job
      const endpointsData = await jobsApi.getEndpoints(namespace, jobName);
      setEndpoints(endpointsData);
    } catch (err: any) {
      console.error('Failed to unassign endpoint:', err);
      alert(err.response?.data?.detail || 'Failed to unassign endpoint');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link to="/jobs" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-2 inline-block">
            ← Back to jobs
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{manifest.metadata.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{jobPath}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate(`/jobs/${namespace}/${jobName}/edit`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            🗑️ Delete
          </button>
          <a
            href={gitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            View in Git →
          </a>
        </div>
      </div>

      {!job.valid && job.error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h4 className="text-yellow-800 dark:text-yellow-400 font-medium text-sm">Validation Warning</h4>
          <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">{job.error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Schedule</h4>
          <p className="text-lg font-mono text-gray-900 dark:text-white">{manifest.spec.schedule}</p>
          {manifest.spec.timezone && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{manifest.spec.timezone}</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Status</h4>
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              manifest.spec.enabled === false || manifest.spec.paused
                ? 'bg-gray-100 text-gray-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {manifest.spec.enabled === false ? 'Disabled' : manifest.spec.paused ? 'Paused' : 'Enabled'}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Environment</h4>
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              manifest._meta?.namespace === 'production'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {manifest._meta?.namespace || 'unknown'}
          </span>
        </div>
      </div>

      {manifest.metadata.labels && Object.keys(manifest.metadata.labels).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Labels</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(manifest.metadata.labels).map(([key, value]) => (
              <span key={key} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      <ManifestViewer content={manifest._meta?.raw_content || ''} fileName={jobPath} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Endpoints Running This Job</h3>
          <Link
            to={`/jobs/${namespace}/${jobName}/assign-endpoints`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition"
          >
            <Plus className="w-3 h-3" />
            Assign Endpoints
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Hostname
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Heartbeat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {endpoints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    Not assigned to any endpoints
                  </td>
                </tr>
              ) : (
                endpoints.map((endpoint) => (
                  <tr key={endpoint.endpoint_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {endpoint.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {endpoint.hostname}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {endpoint.platform}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          endpoint.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : endpoint.status === 'inactive'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {endpoint.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {endpoint.last_heartbeat
                        ? new Date(endpoint.last_heartbeat).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleUnassignEndpoint(String(endpoint.endpoint_id))}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Unassign endpoint"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Recent Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Started At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No runs yet
                  </td>
                </tr>
              ) : (
                runs.slice(0, 10).map((run) => (
                  <tr key={run.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          run.status === 'success'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : run.status === 'failure'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {run.duration_seconds ? `${run.duration_seconds}s` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Job</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to delete <strong>{manifest.metadata.name}</strong>?
              This will remove the job from Git and cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
