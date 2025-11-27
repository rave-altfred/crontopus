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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-mono uppercase">Run by Endpoint</h2>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              Name
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
              Hostname
            </label>
            <input
              type="text"
              value={hostnameFilter}
              onChange={(e) => setHostnameFilter(e.target.value)}
              placeholder="Filter by hostname..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Platform
            </label>
            <input
              type="text"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              placeholder="Filter by platform..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Machine ID
            </label>
            <input
              type="text"
              value={machineIdFilter}
              onChange={(e) => setMachineIdFilter(e.target.value)}
              placeholder="Filter by machine ID..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-[#44475a]">
          <thead className="bg-gray-50 dark:bg-[#21222c]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Hostname
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Machine ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Version
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
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-[#6272a4] font-mono text-sm">
                  NO ENDPOINT RUNS IN THE SELECTED TIME WINDOW
                </td>
              </tr>
            ) : (
              endpoints.map((endpoint) => (
                <tr key={endpoint.id} className="hover:bg-gray-50 dark:hover:bg-[#21222c] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-gray-900 dark:text-white">{endpoint.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">{endpoint.hostname || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    {endpoint.platform}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500 dark:text-[#6272a4]">
                    {endpoint.machine_id.substring(0, 12)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    {endpoint.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    {endpoint.run_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-green-600 dark:text-green-400">
                    {endpoint.success_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-600 dark:text-red-400">
                    {endpoint.failure_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-xs font-mono border ${
                      endpoint.health === 'healthy'
                        ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400'
                        : endpoint.health === 'degraded'
                        ? 'border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400'
                        : 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                    }`}>
                      {endpoint.health.toUpperCase()}
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
