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
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
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

  const handleUnassignEndpoint = async (endpointId: number) => {
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">{manifest.metadata.name}</h2>
          <p className="text-sm font-mono text-gray-500 dark:text-[#6272a4] mt-1">{jobPath}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate(`/jobs/${namespace}/${jobName}/edit`)}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
          <a
            href={gitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-800 text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-gray-900 dark:bg-[#44475a] dark:hover:bg-[#6272a4] transition-colors"
          >
            Git
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
        <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-4">
          <h4 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-2 uppercase tracking-wider">Schedule</h4>
          <p className="text-lg font-mono text-gray-900 dark:text-white">{manifest.spec.schedule}</p>
          {manifest.spec.timezone && (
            <p className="text-xs font-mono text-gray-500 dark:text-[#6272a4] mt-1">{manifest.spec.timezone}</p>
          )}
        </div>

        <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-4">
          <h4 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-2 uppercase tracking-wider">Status</h4>
          <span
            className={`px-2 py-0.5 text-xs font-mono border ${
              manifest.spec.enabled === false || manifest.spec.paused
                ? 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
                : 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            }`}
          >
            {(manifest.spec.enabled === false ? 'DISABLED' : manifest.spec.paused ? 'PAUSED' : 'ENABLED')}
          </span>
        </div>

        <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-4">
          <h4 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-2 uppercase tracking-wider">Group</h4>
          <span
            className={`px-2 py-0.5 text-xs font-mono border ${
              manifest._meta?.namespace === 'production'
                ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
            }`}
          >
            {manifest._meta?.namespace || 'unknown'}
          </span>
        </div>
      </div>

      {manifest.metadata.labels && Object.keys(manifest.metadata.labels).length > 0 && (
        <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-4">
          <h4 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-3 uppercase tracking-wider">Labels</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(manifest.metadata.labels).map(([key, value]) => (
              <span key={key} className="px-2 py-1 bg-gray-100 dark:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] text-xs font-mono border border-gray-200 dark:border-gray-600">
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      <ManifestViewer content={manifest._meta?.raw_content || ''} fileName={jobPath} />

      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-[#44475a] flex justify-between items-center">
          <h3 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Endpoints Running This Job</h3>
          <Link
            to={`/jobs/${namespace}/${jobName}/assign-endpoints`}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors"
          >
            <Plus className="w-3 h-3" />
            Assign Endpoints
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-[#44475a]">
            <thead className="bg-gray-50 dark:bg-[#21222c]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Hostname
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Last Heartbeat
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#282a36] divide-y divide-gray-200 dark:divide-[#44475a]">
              {endpoints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-[#6272a4] text-sm font-mono">
                    Not assigned to any endpoints
                  </td>
                </tr>
              ) : (
                endpoints.map((endpoint) => (
                  <tr key={endpoint.endpoint_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900 dark:text-white">
                      {endpoint.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {endpoint.hostname}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {endpoint.platform}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-mono border ${
                          endpoint.status === 'active'
                            ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400'
                            : endpoint.status === 'inactive'
                            ? 'border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400'
                            : 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                        }`}
                      >
                        {endpoint.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {endpoint.last_heartbeat
                        ? new Date(endpoint.last_heartbeat).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleUnassignEndpoint(endpoint.endpoint_id)}
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

      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-[#44475a]">
          <h3 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Recent Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-[#44475a]">
            <thead className="bg-gray-50 dark:bg-[#21222c]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Started At
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#282a36] divide-y divide-gray-200 dark:divide-[#44475a]">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-[#6272a4] text-sm font-mono">
                    No runs yet
                  </td>
                </tr>
              ) : (
                runs.slice(0, 10).map((run) => (
                  <tr key={run.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-mono border ${
                          run.status === 'success'
                            ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400'
                            : run.status === 'failure'
                            ? 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                            : 'border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400'
                        }`}
                      >
                        {run.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {run.duration ? `${run.duration}s` : '-'}
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
          <div className="bg-white dark:bg-[#44475a] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Job</h3>
            <p className="text-gray-600 dark:text-[#f8f8f2] mb-4">
              Are you sure you want to delete <strong>{manifest.metadata.name}</strong>?
              This will remove the job from Git and cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-[#f8f8f2] hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
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
