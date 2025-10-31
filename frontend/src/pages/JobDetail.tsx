import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobsApi, type JobDetailResponse } from '../api/jobs';
import { runsApi, type JobRun } from '../api/runs';
import { ManifestViewer } from '../components/ManifestViewer';

export const JobDetail = () => {
  const { '*': jobPath } = useParams();
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobPath) return;

    Promise.all([
      jobsApi.get(jobPath),
      runsApi.listByJob(jobPath.replace(/\.(yaml|yml)$/, '').split('/').pop() || ''),
    ])
      .then(([jobData, runsData]) => {
        setJob(jobData);
        setRuns(runsData);
      })
      .catch((err) => {
        console.error('Failed to load job:', err);
        setError(err.response?.data?.detail || 'Failed to load job');
      })
      .finally(() => setLoading(false));
  }, [jobPath]);

  if (loading) {
    return <div className="text-gray-600">Loading...</div>;
  }

  if (error || !job) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error loading job</h3>
        <p className="text-red-600 text-sm mt-1">{error || 'Job not found'}</p>
        <Link to="/jobs" className="text-red-600 hover:text-red-800 text-sm mt-2 inline-block">
          ← Back to jobs
        </Link>
      </div>
    );
  }

  const { manifest } = job;
  const gitUrl = `https://git.crontopus.com/crontopus/job-manifests/src/branch/main/${jobPath}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link to="/jobs" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
            ← Back to jobs
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{manifest.metadata.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{jobPath}</p>
        </div>
        <a
          href={gitUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Edit in Git →
        </a>
      </div>

      {!job.valid && job.error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-yellow-800 font-medium text-sm">Validation Warning</h4>
          <p className="text-yellow-700 text-sm mt-1">{job.error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Schedule</h4>
          <p className="text-lg font-mono text-gray-900">{manifest.spec.schedule}</p>
          {manifest.spec.timezone && (
            <p className="text-xs text-gray-500 mt-1">{manifest.spec.timezone}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Status</h4>
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

        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Environment</h4>
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
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Labels</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(manifest.metadata.labels).map(([key, value]) => (
              <span key={key} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      <ManifestViewer content={manifest._meta?.raw_content || ''} fileName={jobPath} />

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Recent Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500 text-sm">
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
                            ? 'bg-green-100 text-green-800'
                            : run.status === 'failure'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.duration_seconds ? `${run.duration_seconds}s` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
