import { useEffect, useState } from 'react';
import { runsApi, type JobRun } from '../api/runs';
import { agentsApi, type Agent } from '../api/agents';

export const Runs = () => {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [endpoints, setEndpoints] = useState<Map<number, Agent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Filters
  const [limit, setLimit] = useState(100);
  const [jobNameFilter, setJobNameFilter] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [days, setDays] = useState<number | undefined>(undefined);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      runsApi.list({
        limit,
        job_name: jobNameFilter || undefined,
        namespace: namespaceFilter || undefined,
        status: statusFilter || undefined,
        days: days || undefined
      }),
      agentsApi.list()
    ])
      .then(([runsData, agentsData]) => {
        setRuns(runsData);
        const endpointMap = new Map(
          agentsData.map(e => [e.id, e])
        );
        setEndpoints(endpointMap);
      })
      .catch((err) => console.error('Failed to load data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [limit, jobNameFilter, namespaceFilter, statusFilter, days]);

  const toggleRow = (runId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Job Run Log</h2>

      {/* Filters */}
      <div className="bg-white dark:bg-[#282a36] rounded-lg border border-gray-200 dark:border-[#44475a] p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-mono font-semibold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Limit
            </label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              min={1}
              max={1000}
              className="w-full text-sm font-mono bg-white dark:bg-[#44475a] border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#bd93f9]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Job Name
            </label>
            <input
              type="text"
              value={jobNameFilter}
              onChange={(e) => setJobNameFilter(e.target.value)}
              placeholder="filter..."
              className="w-full text-sm font-mono bg-white dark:bg-[#44475a] border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#bd93f9]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Namespace
            </label>
            <input
              type="text"
              value={namespaceFilter}
              onChange={(e) => setNamespaceFilter(e.target.value)}
              placeholder="filter..."
              className="w-full text-sm font-mono bg-white dark:bg-[#44475a] border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#bd93f9]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-sm font-mono bg-white dark:bg-[#44475a] border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#bd93f9]"
            >
              <option value="">ALL STATUSES</option>
              <option value="success">SUCCESS</option>
              <option value="failure">FAILURE</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Time Window
            </label>
            <select
              value={days || ''}
              onChange={(e) => setDays(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full text-sm font-mono bg-white dark:bg-[#44475a] border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#bd93f9]"
            >
              <option value="">ALL TIME</option>
              <option value={1}>LAST 24 HOURS</option>
              <option value={7}>LAST 7 DAYS</option>
              <option value={30}>LAST 30 DAYS</option>
              <option value={90}>LAST 90 DAYS</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-[#44475a]">
          <thead className="bg-gray-50 dark:bg-[#21222c]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Namespace
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Endpoint
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Exit Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Started At
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#282a36] divide-y divide-gray-200 dark:divide-[#44475a]">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center font-mono text-sm text-gray-500 dark:text-[#6272a4]">
                  No job runs yet
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const isExpanded = expandedRows.has(run.id);
                const endpoint = run.endpoint_id ? endpoints.get(run.endpoint_id) : null;
                return (
                  <>
                  <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-[#44475a]/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono font-medium text-gray-900 dark:text-[#f8f8f2]">{run.job_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">{run.namespace || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">{endpoint?.name || '-'}</div>
                    </td>
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
                      {run.exit_code !== null ? run.exit_code : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {run.duration !== null ? `${run.duration}s` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => toggleRow(run.id)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${run.id}-details`}>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50 dark:bg-[#21222c] border-t border-gray-200 dark:border-[#44475a]">
                        <div className="space-y-3">
                          {run.output && (
                            <div>
                              <h4 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">Output:</h4>
                              <pre className="text-xs font-mono bg-white dark:bg-[#282a36] p-3 border border-gray-200 dark:border-[#44475a] overflow-x-auto text-gray-800 dark:text-[#f8f8f2]">
                                {run.output}
                              </pre>
                            </div>
                          )}
                          {run.error_message && (
                            <div>
                              <h4 className="text-xs font-mono font-bold text-red-600 dark:text-[#ff5555] mb-1 uppercase tracking-wider">Error:</h4>
                              <pre className="text-xs font-mono bg-red-50 dark:bg-red-900/10 p-3 border border-red-200 dark:border-red-800 overflow-x-auto text-red-900 dark:text-[#ff5555]">
                                {run.error_message}
                              </pre>
                            </div>
                          )}
                          {!run.output && !run.error_message && (
                            <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">No output or error details available</div>
                          )}
                        </div>
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
    </div>
  );
};
