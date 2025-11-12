import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ChevronDown, ChevronRight, Plus, X, Edit2, Check } from 'lucide-react';
import { agentsApi, type Agent, type JobInstance } from '../api/agents';

export const Endpoints = () => {
  const [endpoints, setEndpoints] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [jobsByEndpoint, setJobsByEndpoint] = useState<Record<number, JobInstance[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    agentsApi
      .list()
      .then(setEndpoints)
      .catch((err) => console.error('Failed to load endpoints:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleUnassignJob = async (endpointId: number, namespace: string, jobName: string) => {
    if (!confirm(`Unassign ${namespace}/${jobName} from this endpoint?`)) return;

    try {
      await agentsApi.unassignJob(endpointId, namespace, jobName);
      
      // Reload jobs for this endpoint
      const jobs = await agentsApi.getJobs(endpointId);
      setJobsByEndpoint({ ...jobsByEndpoint, [endpointId]: jobs });
    } catch (err: any) {
      console.error('Failed to unassign job:', err);
      alert(err.response?.data?.detail || 'Failed to unassign job');
    }
  };

  const handleStartEdit = (endpoint: Agent) => {
    setEditingId(endpoint.id);
    setEditName(endpoint.name);
  };

  const handleSaveEdit = async (endpointId: number) => {
    if (!editName.trim()) return;
    
    try {
      const updated = await agentsApi.rename(endpointId, editName);
      setEndpoints(endpoints.map(e => e.id === endpointId ? updated : e));
      setEditingId(null);
    } catch (err: any) {
      console.error('Failed to rename endpoint:', err);
      alert(err.response?.data?.detail || 'Failed to rename endpoint');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

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
                Version
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
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No endpoints enrolled yet
                </td>
              </tr>
            ) : (
              endpoints.map((endpoint) => (
                <>
                  <tr key={endpoint.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer" onClick={async () => {
                    const id = endpoint.id;
                    const next = !expanded[id];
                    setExpanded({ ...expanded, [id]: next });
                    if (next && !jobsByEndpoint[id] && !loadingJobs[id]) {
                      setLoadingJobs({ ...loadingJobs, [id]: true });
                      try {
                        const jobs = await agentsApi.getJobs(String(id));
                        setJobsByEndpoint({ ...jobsByEndpoint, [id]: jobs });
                      } catch (e) {
                        console.error('Failed to load jobs for endpoint', id, e);
                      } finally {
                        setLoadingJobs({ ...loadingJobs, [id]: false });
                      }
                    }
                  }}>
                    <td className="px-6 py-4 whitespace-nowrap w-8">
                      {expanded[endpoint.id] ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === endpoint.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(endpoint.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(endpoint.id)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{endpoint.name}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(endpoint);
                            }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Rename endpoint"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {endpoint.version || 'N/A'}
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
                  {expanded[endpoint.id] && (
                    <tr>
                      <td colSpan={8} className="px-6 py-3 bg-gray-50 dark:bg-gray-900">
                        {loadingJobs[endpoint.id] ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400">Loading jobs...</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Jobs on this endpoint</div>
                              <Link
                                to={`/endpoints/${endpoint.id}/assign-jobs`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition"
                              >
                                <Plus className="w-3 h-3" />
                                Assign Jobs
                              </Link>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-100 dark:bg-gray-800">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Group</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Job</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Seen</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                  {(jobsByEndpoint[endpoint.id] || []).map((ji: JobInstance) => (
                                    <tr key={ji.id}>
                                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ji.namespace}</td>
                                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ji.job_name}</td>
                                      <td className="px-4 py-2 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                          ji.source === 'crontopus'
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
                                      <td className="px-4 py-2 text-sm">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUnassignJob(endpoint.id, ji.namespace, ji.job_name);
                                          }}
                                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                          title="Unassign job"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
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
