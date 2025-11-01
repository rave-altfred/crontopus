import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsApi, type JobListItem } from '../api/jobs';

export const Jobs = () => {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'production' | 'staging'>('all');
  const [repository, setRepository] = useState<string>('');

  useEffect(() => {
    const namespace = filter === 'all' ? undefined : filter;
    
    jobsApi
      .list(namespace)
      .then((response) => {
        setJobs(response.jobs);
        setRepository(response.repository);
      })
      .catch((err) => console.error('Failed to load jobs:', err))
      .finally(() => setLoading(false));
  }, [filter]);

  if (loading) {
    return <div className="text-gray-600">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Job Manifests</h2>
        <div className="flex items-center space-x-4">
          <Link
            to="/jobs/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            + New Job
          </Link>
          {repository && (
            <a
              href={repository}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View in Git →
            </a>
          )}
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('production')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'production'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Production
        </button>
        <button
          onClick={() => setFilter('staging')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'staging'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Staging
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Environment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Path
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No job manifests found
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.sha} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {job.name.replace(/\.(yaml|yml)$/, '')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.namespace === 'production'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {job.namespace}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.path}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/jobs/${job.path}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500">
        <p>
          Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''} from Git
        </p>
        <p className="mt-1 text-xs">
          💡 Job definitions are stored in Git. Changes require a Git commit.
        </p>
      </div>
    </div>
  );
};
