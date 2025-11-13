import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { runsApi, type JobRun } from '../api/runs';
import { agentsApi, type Agent } from '../api/agents';

export const Dashboard = () => {
  const [recentRuns, setRecentRuns] = useState<JobRun[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      runsApi.list({ limit: 5 }),
      agentsApi.list(),
    ])
      .then(([runs, agentsList]) => {
        setRecentRuns(Array.isArray(runs) ? runs : []);
        setAgents(Array.isArray(agentsList) ? agentsList : []);
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
        setRecentRuns([]);
        setAgents([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const successfulRuns = recentRuns.filter(r => r.status === 'success').length;
  const failedRuns = recentRuns.filter(r => r.status === 'failure').length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#44475a] p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-[#6272a4]">Active Agents</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-[#f8f8f2]">{activeAgents}</p>
        </div>
        <div className="bg-white dark:bg-[#44475a] p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-[#6272a4]">Successful Runs (Last 5)</h3>
          <p className="mt-2 text-3xl font-bold text-green-600 dark:text-[#50fa7b]">{successfulRuns}</p>
        </div>
        <div className="bg-white dark:bg-[#44475a] p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-[#6272a4]">Failed Runs (Last 5)</h3>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-[#ff5555]">{failedRuns}</p>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#6272a4]">
          <h3 className="text-lg font-medium text-gray-900 dark:text-[#f8f8f2]">Recent Job Runs</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-[#6272a4]">
          {recentRuns.length === 0 ? (
            <div className="px-6 py-4 text-gray-500 dark:text-[#6272a4]">No runs yet</div>
          ) : (
            recentRuns.map((run) => (
              <div key={run.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-[#f8f8f2]">{run.job_name}</p>
                  <p className="text-sm text-gray-500 dark:text-[#6272a4]">
                    {new Date(run.started_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    run.status === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-[#50fa7b]/20 dark:text-[#50fa7b]'
                      : run.status === 'failure'
                      ? 'bg-red-100 text-red-800 dark:bg-[#ff5555]/20 dark:text-[#ff5555]'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-[#f1fa8c]/20 dark:text-[#f1fa8c]'
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#6272a4]">
          <Link to="/runs" className="text-brand-600 dark:text-[#bd93f9] hover:text-brand-800 dark:hover:text-[#ff79c6] text-sm font-medium">
            View all runs →
          </Link>
        </div>
      </div>
    </div>
  );
};
