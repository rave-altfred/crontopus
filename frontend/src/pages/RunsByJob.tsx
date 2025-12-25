import { useEffect, useState } from 'react';
import { runsApi, type JobAggregation } from '../api/runs';

export const RunsByJob = () => {
  const [jobs, setJobs] = useState<JobAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [days, setDays] = useState(7);
  const [nameFilter, setNameFilter] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = () => {
    setLoading(true);
    runsApi
      .aggregatedByJob({
        days,
        job_name: nameFilter || undefined,
        namespace: namespaceFilter || undefined,
        status: statusFilter || undefined,
      })
      .then(setJobs)
      .catch((err) => console.error('Failed to load job aggregations:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [days, nameFilter, namespaceFilter, statusFilter]);

  if (loading) {
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-mono uppercase">Run by Job</h2>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Time Window
            </label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={1}>LAST 24 HOURS</option>
              <option value={7}>LAST 7 DAYS</option>
              <option value={30}>LAST 30 DAYS</option>
              <option value={90}>LAST 90 DAYS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Job Name
            </label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Namespace
            </label>
            <input
              type="text"
              value={namespaceFilter}
              onChange={(e) => setNamespaceFilter(e.target.value)}
              placeholder="Filter by namespace..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">ALL STATUSES</option>
              <option value="success">SUCCESS</option>
              <option value="failure">FAILURE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-[#44475a]">
          <thead className="bg-gray-50 dark:bg-[#21222c]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Namespace
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Endpoints
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Total Runs
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Success
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Failures
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Health
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#282a36] divide-y divide-gray-200 dark:divide-[#44475a]">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-[#6272a4] font-mono text-sm">
                  NO JOB RUNS IN THE SELECTED TIME WINDOW
                </td>
              </tr>
            ) : (
              jobs.map((job, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-[#21222c] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-gray-900 dark:text-white">{job.job_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">{job.namespace}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    {job.endpoint_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    {job.run_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-green-600 dark:text-green-400">
                    {job.success_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-600 dark:text-red-400">
                    {job.failure_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-xs font-mono border ${
                      job.health === 'healthy'
                        ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400'
                        : job.health === 'degraded'
                        ? 'border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400'
                        : 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                    }`}>
                      {job.health.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
