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
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
  }

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const successfulRuns = recentRuns.filter(r => r.status === 'success').length;
  const failedRuns = recentRuns.filter(r => r.status === 'failure').length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#21222c] p-6 rounded-lg shadow-sm dark:shadow-none border-l-4 border-brand-500 dark:border-[#bd93f9]">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Active Agents</h3>
          <p className="mt-2 text-3xl font-mono font-bold text-gray-900 dark:text-[#f8f8f2]">{activeAgents}</p>
        </div>
        <div className="bg-white dark:bg-[#21222c] p-6 rounded-lg shadow-sm dark:shadow-none border-l-4 border-green-500 dark:border-[#50fa7b]">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Successful Runs (Last 5)</h3>
          <p className="mt-2 text-3xl font-mono font-bold text-green-600 dark:text-[#50fa7b]">{successfulRuns}</p>
        </div>
        <div className="bg-white dark:bg-[#21222c] p-6 rounded-lg shadow-sm dark:shadow-none border-l-4 border-red-500 dark:border-[#ff5555]">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Failed Runs (Last 5)</h3>
          <p className="mt-2 text-3xl font-mono font-bold text-red-600 dark:text-[#ff5555]">{failedRuns}</p>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-white dark:bg-[#21222c] rounded-lg shadow-sm dark:shadow-none border border-gray-200 dark:border-[#44475a]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#44475a]">
          <h3 className="text-lg font-medium text-gray-900 dark:text-[#f8f8f2]">Recent Job Runs</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-[#44475a]/50">
          {recentRuns.length === 0 ? (
            <div className="px-6 py-4 text-gray-500 dark:text-[#6272a4]">No runs yet</div>
          ) : (
            recentRuns.map((run) => (
              <div key={run.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#44475a]/20 transition-colors">
                <div>
                  <p className="font-mono text-sm font-medium text-gray-900 dark:text-[#f8f8f2]">{run.job_name}</p>
                  <p className="font-mono text-xs text-gray-500 dark:text-[#6272a4] mt-1">
                    {new Date(run.started_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-mono uppercase tracking-wide ${
                    run.status === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-[#50fa7b]/20 dark:text-[#50fa7b] border border-green-200 dark:border-[#50fa7b]/30'
                      : run.status === 'failure'
                      ? 'bg-red-100 text-red-800 dark:bg-[#ff5555]/20 dark:text-[#ff5555] border border-red-200 dark:border-[#ff5555]/30'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-[#f1fa8c]/20 dark:text-[#f1fa8c] border border-yellow-200 dark:border-[#f1fa8c]/30'
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#44475a]">
          <Link to="/runs" className="text-brand-600 dark:text-[#bd93f9] hover:text-brand-800 dark:hover:text-[#ff79c6] text-sm font-medium">
            View all runs →
          </Link>
        </div>
      </div>
    </div>
  );
};
