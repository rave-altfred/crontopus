import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { jobsApi, type JobListItem, type JobEndpoint } from '../api/jobs';
import { namespacesApi, type Namespace } from '../api/namespaces';

export const Jobs = () => {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [repository, setRepository] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [endpointsByJob, setEndpointsByJob] = useState<Record<string, JobEndpoint[]>>({});
  const [loadingEndpoints, setLoadingEndpoints] = useState<Record<string, boolean>>({});

  // Fetch namespaces on mount
  useEffect(() => {
    namespacesApi
      .list()
      .then((data) => setNamespaces(data))
      .catch((err) => console.error('Failed to load namespaces:', err));
  }, []);

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
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
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

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1 text-sm font-mono border transition-colors ${
            filter === 'all'
              ? 'bg-gray-900 text-white border-gray-900 dark:bg-[#bd93f9] dark:text-[#282a36] dark:border-[#bd93f9]'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-[#282a36] dark:text-[#f8f8f2] dark:border-[#6272a4] dark:hover:bg-[#44475a]'
          }`}
        >
          ALL
        </button>
        {namespaces.map((ns) => (
          <button
            key={ns.name}
            onClick={() => setFilter(ns.name)}
            className={`px-4 py-1 text-sm font-mono border transition-colors ${
              filter === ns.name
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-[#bd93f9] dark:text-[#282a36] dark:border-[#bd93f9]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-[#282a36] dark:text-[#f8f8f2] dark:border-[#6272a4] dark:hover:bg-[#44475a]'
            }`}
          >
            {ns.name === 'discovered' && '🔍 '}{ns.name.toUpperCase()}
            {ns.job_count > 0 && (
              <span className="ml-2 opacity-75">[{ns.job_count}]</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-[#44475a]">
          <thead className="bg-gray-50 dark:bg-[#21222c]">
            <tr>
              <th className="px-6 py-3 w-8"></th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Group
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Path
              </th>
              <th className="px-6 py-3 text-right text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#282a36] divide-y divide-gray-200 dark:divide-[#44475a]">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm font-mono text-gray-500 dark:text-[#6272a4]">
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
                      className="hover:bg-gray-50 dark:hover:bg-[#44475a]/20 cursor-pointer transition-colors"
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
                    <div className="text-sm font-mono font-medium text-gray-900 dark:text-[#f8f8f2]">
                      {job.name.replace(/\.(yaml|yml)$/, '')}
                      {endpointsByJob[jobKey] && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-[#6272a4]">
                          [{endpointsByJob[jobKey]?.length || 0}]
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 text-xs font-mono border ${
                        job.namespace === 'production'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                          : job.namespace === 'discovered'
                          ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
                          : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800'
                      }`}
                    >
                      {job.namespace === 'discovered' ? '🔍 ' : ''}{job.namespace}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    {job.path}
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/jobs/${job.namespace}/${job.name.replace(/\.(yaml|yml)$/, '')}/assign-endpoints`}
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Plus className="w-3 h-3" />
                            Assign
                          </Link>
                          <Link
                            to={`/jobs/${job.path}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expanded[jobKey] && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50 dark:bg-[#21222c] border-t border-gray-200 dark:border-[#44475a]">
                          {loadingEndpoints[jobKey] ? (
                            <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">Loading endpoints...</div>
                          ) : (
                            <div className="space-y-3 pl-8 border-l-2 border-gray-300 dark:border-[#44475a]">
                              <div className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                                Endpoints ({endpointsByJob[jobKey]?.length || 0})
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead className="border-b border-gray-200 dark:border-[#44475a]">
                                    <tr>
                                      <th className="px-4 py-2 text-left font-mono text-xs text-gray-500 dark:text-[#6272a4]">NAME</th>
                                      <th className="px-4 py-2 text-left font-mono text-xs text-gray-500 dark:text-[#6272a4]">PLATFORM</th>
                                      <th className="px-4 py-2 text-left font-mono text-xs text-gray-500 dark:text-[#6272a4]">STATUS</th>
                                      <th className="px-4 py-2 text-left font-mono text-xs text-gray-500 dark:text-[#6272a4]">LAST HEARTBEAT</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 dark:divide-[#44475a]/50">
                                    {(endpointsByJob[jobKey] || []).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="px-4 py-2 font-mono text-center text-gray-500 dark:text-[#6272a4]">
                                          No endpoints running this job
                                        </td>
                                      </tr>
                                    ) : (
                                      (endpointsByJob[jobKey] || []).map((ep) => (
                                        <tr key={ep.endpoint_id}>
                                          <td className="px-4 py-2 font-mono text-gray-700 dark:text-[#f8f8f2]">{ep.name}</td>
                                          <td className="px-4 py-2 font-mono text-gray-500 dark:text-[#6272a4]">{ep.platform}</td>
                                          <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 text-xs font-mono border ${
                                              ep.status === 'active'
                                                ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400'
                                                : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
                                            }`}>
                                              {ep.status.toUpperCase()}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 font-mono text-gray-500 dark:text-[#6272a4]">
                                            {ep.last_heartbeat ? new Date(ep.last_heartbeat).toLocaleString() : 'Never'}
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

      <div className="text-sm text-gray-500 dark:text-[#6272a4]">
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
