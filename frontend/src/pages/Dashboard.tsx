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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Agents</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{activeAgents}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Successful Runs (Last 5)</h3>
          <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">{successfulRuns}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Failed Runs (Last 5)</h3>
          <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">{failedRuns}</p>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Job Runs</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentRuns.length === 0 ? (
            <div className="px-6 py-4 text-gray-500 dark:text-gray-400">No runs yet</div>
          ) : (
            recentRuns.map((run) => (
              <div key={run.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{run.job_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(run.started_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    run.status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : run.status === 'failure'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <Link to="/runs" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium">
            View all runs →
          </Link>
        </div>
      </div>
    </div>
  );
};
