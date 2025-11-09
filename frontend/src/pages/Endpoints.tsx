import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { agentsApi, type Agent, type JobInstance } from '../api/agents';

export const Endpoints = () => {
  const [endpoints, setEndpoints] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [jobsByEndpoint, setJobsByEndpoint] = useState<Record<string, JobInstance[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    agentsApi
      .list()
      .then(setEndpoints)
      .catch((err) => console.error('Failed to load endpoints:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Endpoints</h2>
        <Link
          to="/agents"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition"
        >
          <Download className="w-4 h-4" />
          Download Agent
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 w-8"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Hostname
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Machine ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Heartbeat
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No endpoints enrolled yet
                </td>
              </tr>
            ) : (
              endpoints.map((endpoint) => (
                <>
                  <tr key={endpoint.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer" onClick={async () => {
                    const id = String(endpoint.id);
                    const next = !expanded[id];
                    setExpanded({ ...expanded, [id]: next });
                    if (next && !jobsByEndpoint[id] && !loadingJobs[id]) {
                      setLoadingJobs({ ...loadingJobs, [id]: true });
                      try {
                        const jobs = await agentsApi.getJobs(id);
                        setJobsByEndpoint({ ...jobsByEndpoint, [id]: jobs });
                      } catch (e) {
                        console.error('Failed to load jobs for endpoint', id, e);
                      } finally {
                        setLoadingJobs({ ...loadingJobs, [id]: false });
                      }
                    }
                  }}>
                    <td className="px-6 py-4 whitespace-nowrap w-8">
                      {expanded[String(endpoint.id)] ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{endpoint.name}</div>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">{endpoint.hostname}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">{endpoint.platform}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {endpoint.machine_id ? endpoint.machine_id.substring(0, 12) + '...' : 'N/A'}
                    </div>
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
                  </tr>
                  {expanded[String(endpoint.id)] && (
                    <tr>
                      <td colSpan={7} className="px-6 py-3 bg-gray-50 dark:bg-gray-900">
                        {loadingJobs[String(endpoint.id)] ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400">Loading jobs...</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Jobs on this endpoint</div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-100 dark:bg-gray-800">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Job</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Seen</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                  {(jobsByEndpoint[String(endpoint.id)] || []).map((ji) => (
                                    <tr key={ji.id}>
                                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ji.namespace}</td>
                                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ji.job_name}</td>
                                      <td className="px-4 py-2 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                          ji.source === 'git'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                        }`}>
                                          {ji.source}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                          ji.status === 'scheduled'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            : ji.status === 'running'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                            : ji.status === 'paused'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        }`}>
                                          {ji.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                        {new Date(ji.last_seen).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
