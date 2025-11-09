import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { jobsApi, type JobListItem } from '../api/jobs';
import type { Agent } from '../api/agents';

export const Jobs = () => {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'production' | 'staging'>('all');
  const [repository, setRepository] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [endpointsByJob, setEndpointsByJob] = useState<Record<string, Agent[]>>({});
  const [loadingEndpoints, setLoadingEndpoints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const namespace = filter === 'all' ? undefined : filter;
    setLoading(true);
    setError(null);
    
    jobsApi
      .list(namespace)
      .then((response) => {
        // Ensure jobs is always an array
        setJobs(Array.isArray(response.jobs) ? response.jobs : []);
        setRepository(response.repository || '');
      })
      .catch((err) => {
        console.error('Failed to load jobs:', err);
        setError(err.response?.data?.detail || err.message || 'Failed to load jobs');
        setJobs([]);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Job Manifests</h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Job Manifests</h2>
        <div className="flex items-center space-x-4">
          <Link
            to="/jobs/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            + New Job
          </Link>
          {repository && (
            <a
              href={repository}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              View in Git →
            </a>
          )}
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('production')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'production'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Production
        </button>
        <button
          onClick={() => setFilter('staging')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'staging'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Staging
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 w-8"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Environment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Path
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No job manifests found
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const jobKey = `${job.namespace}/${job.name.replace(/\.(yaml|yml)$/, '')}`;
                return (
                  <>
                    <tr
                      key={job.sha}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={async () => {
                        const next = !expanded[jobKey];
                        setExpanded({ ...expanded, [jobKey]: next });
                        if (next && !endpointsByJob[jobKey] && !loadingEndpoints[jobKey]) {
                          setLoadingEndpoints({ ...loadingEndpoints, [jobKey]: true });
                          try {
                            const endpoints = await jobsApi.getEndpoints(
                              job.namespace,
                              job.name.replace(/\.(yaml|yml)$/, '')
                            );
                            setEndpointsByJob({ ...endpointsByJob, [jobKey]: endpoints });
                          } catch (e) {
                            console.error('Failed to load endpoints for job', jobKey, e);
                          } finally {
                            setLoadingEndpoints({ ...loadingEndpoints, [jobKey]: false });
                          }
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap w-8">
                        {expanded[jobKey] ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {job.name.replace(/\.(yaml|yml)$/, '')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.namespace === 'production'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {job.namespace}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {job.path}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/jobs/${job.path}`}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                    {expanded[jobKey] && (
                      <tr>
                        <td colSpan={5} className="px-6 py-3 bg-gray-50 dark:bg-gray-900">
                          {loadingEndpoints[jobKey] ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400">Loading endpoints...</div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Endpoints running this job</div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                  <thead className="bg-gray-100 dark:bg-gray-800">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Platform</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Heartbeat</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {(endpointsByJob[jobKey] || []).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="px-4 py-2 text-sm text-center text-gray-500 dark:text-gray-400">
                                          No endpoints running this job yet
                                        </td>
                                      </tr>
                                    ) : (
                                      (endpointsByJob[jobKey] || []).map((ep) => (
                                        <tr key={ep.id}>
                                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ep.name}</td>
                                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ep.platform}</td>
                                          <td className="px-4 py-2 text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                              ep.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                            }`}>
                                              {ep.status}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                            {new Date(ep.last_heartbeat).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>
          Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''} from Git
        </p>
        <p className="mt-1 text-xs">
          💡 Job definitions are stored in Git. Changes require a Git commit.
        </p>
      </div>
    </div>
  );
};
