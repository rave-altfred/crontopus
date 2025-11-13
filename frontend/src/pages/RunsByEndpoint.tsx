import { useEffect, useState } from 'react';
import { runsApi, type EndpointAggregation } from '../api/runs';

export const RunsByEndpoint = () => {
  const [endpoints, setEndpoints] = useState<EndpointAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [days, setDays] = useState(7);
  const [nameFilter, setNameFilter] = useState('');
  const [hostnameFilter, setHostnameFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [machineIdFilter, setMachineIdFilter] = useState('');

  const loadData = () => {
    setLoading(true);
    runsApi
      .aggregatedByEndpoint({
        days,
        name: nameFilter || undefined,
        hostname: hostnameFilter || undefined,
        platform: platformFilter || undefined,
        machine_id: machineIdFilter || undefined,
      })
      .then(setEndpoints)
      .catch((err) => console.error('Failed to load endpoint aggregations:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [days, nameFilter, hostnameFilter, platformFilter, machineIdFilter]);

  const getHealthBadge = (health: string) => {
    if (health === 'healthy') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Healthy</span>;
    } else if (health === 'degraded') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Degraded</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Warning</span>;
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Run by Endpoint</h2>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
              Time Window
            </label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#44475a] text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
              Name
            </label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name..."
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#44475a] text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
              Hostname
            </label>
            <input
              type="text"
              value={hostnameFilter}
              onChange={(e) => setHostnameFilter(e.target.value)}
              placeholder="Filter by hostname..."
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#44475a] text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
              Platform
            </label>
            <input
              type="text"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              placeholder="Filter by platform..."
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#44475a] text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
              Machine ID
            </label>
            <input
              type="text"
              value={machineIdFilter}
              onChange={(e) => setMachineIdFilter(e.target.value)}
              placeholder="Filter by machine ID..."
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-[#44475a] text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-[#6272a4]">
          <thead className="bg-gray-50 dark:bg-[#44475a]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Hostname
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Machine ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Total Runs
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Success
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Failures
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Health
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#44475a] divide-y divide-gray-200 dark:divide-[#6272a4]">
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-[#6272a4]">
                  No endpoint runs in the selected time window
                </td>
              </tr>
            ) : (
              endpoints.map((endpoint) => (
                <tr key={endpoint.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{endpoint.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-[#6272a4]">{endpoint.hostname || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#6272a4]">
                    {endpoint.platform}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#6272a4] font-mono text-xs">
                    {endpoint.machine_id.substring(0, 16)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#6272a4]">
                    {endpoint.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#6272a4]">
                    {endpoint.run_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                    {endpoint.success_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                    {endpoint.failure_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getHealthBadge(endpoint.health)}
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
