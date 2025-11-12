import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import { agentsApi, type JobInstance } from '../api/agents';
import { jobsApi, type JobListItem } from '../api/jobs';

export const AssignJobsToEndpoint = () => {
  const { endpointId: endpointIdStr } = useParams<{ endpointId: string }>();
  const navigate = useNavigate();
  const endpointId = endpointIdStr ? Number(endpointIdStr) : null;
  
  const [endpoint, setEndpoint] = useState<any>(null);
  const [assignedJobs, setAssignedJobs] = useState<JobInstance[]>([]);
  const [availableJobs, setAvailableJobs] = useState<JobListItem[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');

  useEffect(() => {
    if (!endpointId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [endpointData, jobs, assigned] = await Promise.all([
          agentsApi.get(endpointId),
          jobsApi.list(),
          agentsApi.getJobs(endpointId)
        ]);
        
        setEndpoint(endpointData);
        setAssignedJobs(assigned);
        
        // Filter out already assigned jobs
        const assignedJobKeys = new Set(
          assigned.map(j => `${j.namespace}/${j.job_name}`)
        );
        const available = jobs.jobs.filter(job => {
          const jobKey = `${job.namespace}/${job.name.replace(/\.(yaml|yml)$/, '')}`;
          return !assignedJobKeys.has(jobKey);
        });
        setAvailableJobs(available);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [endpointId]);

  // Apply filters
  const filteredJobs = availableJobs.filter(job => {
    const jobName = job.name.replace(/\.(yaml|yml)$/, '');
    const matchesSearch = 
      jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.path.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesNamespace = namespaceFilter === 'all' || job.namespace === namespaceFilter;
    
    return matchesSearch && matchesNamespace;
  });

  // Get unique namespaces for filter
  const namespaces = Array.from(new Set(availableJobs.map(j => j.namespace).filter(Boolean)));

  const toggleJob = (jobPath: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobPath)) {
      newSelected.delete(jobPath);
    } else {
      newSelected.add(jobPath);
    }
    setSelectedJobs(newSelected);
  };

  const toggleAll = () => {
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map(j => j.path)));
    }
  };

  const handleAssign = async () => {
    if (!endpointId || selectedJobs.size === 0) return;

    setAssigning(true);
    try {
      // Assign all selected jobs
      await Promise.all(
        Array.from(selectedJobs).map(jobPath => {
          const [namespace, ...nameParts] = jobPath.split('/');
          const jobName = nameParts.join('/').replace(/\.(yaml|yml)$/, '');
          return agentsApi.assignJob(endpointId, jobName, namespace);
        })
      );

      // Navigate back to endpoints page
      navigate('/endpoints');
    } catch (err: any) {
      console.error('Failed to assign jobs:', err);
      alert(err.response?.data?.detail || 'Failed to assign jobs');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (!endpoint) {
    return <div className="text-red-600 dark:text-red-400">Endpoint not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/endpoints"
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Endpoints
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Assign Jobs to {endpoint.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {endpoint.hostname} • {endpoint.platform}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select jobs to run on this endpoint. Already assigned jobs are hidden.
          </p>
        </div>
        <button
          onClick={handleAssign}
          disabled={assigning || selectedJobs.size === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {assigning ? 'Assigning...' : `Assign ${selectedJobs.size} Job${selectedJobs.size !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by job name..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Namespace Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Environment
            </label>
            <select
              value={namespaceFilter}
              onChange={(e) => setNamespaceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Environments</option>
              {namespaces.map(namespace => (
                <option key={namespace} value={namespace}>{namespace}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredJobs.length} of {availableJobs.length} available jobs
          {assignedJobs.length > 0 && ` (${assignedJobs.length} already assigned)`}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 w-12">
                <input
                  type="checkbox"
                  checked={filteredJobs.length > 0 && selectedJobs.size === filteredJobs.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Environment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Path
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  {availableJobs.length === 0 
                    ? 'All jobs are already assigned to this endpoint'
                    : 'No jobs match your filters'}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr
                  key={job.path}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => toggleJob(job.path)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.path)}
                      onChange={() => toggleJob(job.path)}
                      className="rounded border-gray-300 dark:border-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {job.name.replace(/\.(yaml|yml)$/, '')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        job.namespace === 'production'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {job.namespace}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {job.path}
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
