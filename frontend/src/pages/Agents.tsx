import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { agentsApi, type Agent } from '../api/agents';

export const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentsApi
      .list()
      .then(setAgents)
      .catch((err) => console.error('Failed to load agents:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agents</h2>
        <Link
          to="/agents/download"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition"
        >
          <Download className="w-4 h-4" />
          Download Agent
        </Link>
      </div>

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
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Last Heartbeat
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#44475a] divide-y divide-gray-200 dark:divide-[#6272a4]">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-[#6272a4]">
                  No agents enrolled yet
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{agent.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-[#6272a4]">{agent.hostname}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-[#6272a4]">{agent.platform}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-gray-500 dark:text-[#6272a4]">
                      {agent.machine_id ? agent.machine_id.substring(0, 12) + '...' : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        agent.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : agent.status === 'inactive'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-[#6272a4]">
                    {agent.last_heartbeat
                      ? new Date(agent.last_heartbeat).toLocaleString()
                      : 'Never'}
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
