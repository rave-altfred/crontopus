import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import { agentsApi, type Agent } from '../api/agents';
import { jobsApi, type JobEndpoint } from '../api/jobs';

export const AssignEndpointsToJob = () => {
  const { namespace, jobName } = useParams<{ namespace: string; jobName: string }>();
  const navigate = useNavigate();
  
  const [assignedEndpoints, setAssignedEndpoints] = useState<JobEndpoint[]>([]);
  const [availableEndpoints, setAvailableEndpoints] = useState<Agent[]>([]);
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!namespace || !jobName) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [endpoints, assigned] = await Promise.all([
          agentsApi.list(),
          jobsApi.getEndpoints(namespace, jobName)
        ]);
        
        setAssignedEndpoints(assigned);
        
        // Filter out already assigned endpoints
        const assignedIds = new Set(assigned.map(e => e.endpoint_id));
        const available = endpoints.filter(e => !assignedIds.has(e.id));
        setAvailableEndpoints(available);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [namespace, jobName]);

  // Apply filters
  const filteredEndpoints = availableEndpoints.filter(endpoint => {
    const matchesSearch = 
      endpoint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (endpoint.machine_id && endpoint.machine_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPlatform = platformFilter === 'all' || endpoint.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || endpoint.status === statusFilter;
    
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  // Get unique platforms for filter
  const platforms = Array.from(new Set(availableEndpoints.map(e => e.platform).filter(Boolean)));

  const toggleEndpoint = (endpointId: number) => {
    const newSelected = new Set(selectedEndpoints);
    if (newSelected.has(endpointId)) {
      newSelected.delete(endpointId);
    } else {
      newSelected.add(endpointId);
    }
    setSelectedEndpoints(newSelected);
  };

  const toggleAll = () => {
    if (selectedEndpoints.size === filteredEndpoints.length) {
      setSelectedEndpoints(new Set());
    } else {
      setSelectedEndpoints(new Set(filteredEndpoints.map(e => e.id)));
    }
  };

  const handleAssign = async () => {
    if (!namespace || !jobName || selectedEndpoints.size === 0) return;

    setAssigning(true);
    try {
      // Assign all selected endpoints
      await Promise.all(
        Array.from(selectedEndpoints).map(endpointId =>
          jobsApi.assignToEndpoint(namespace, jobName, endpointId)
        )
      );

      // Navigate back to job detail page
      navigate(`/jobs/${namespace}/${jobName}`);
    } catch (err: any) {
      console.error('Failed to assign endpoints:', err);
      alert(err.response?.data?.detail || 'Failed to assign endpoints');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/jobs/${namespace}/${jobName}`}
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Assign Endpoints to {jobName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Select endpoints to run this job. Already assigned endpoints are hidden.
          </p>
        </div>
        <button
          onClick={handleAssign}
          disabled={assigning || selectedEndpoints.size === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {assigning ? 'Assigning...' : `Assign ${selectedEndpoints.size} Endpoint${selectedEndpoints.size !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                placeholder="Search by name, hostname, or machine ID..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Platform Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform
            </label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Platforms</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredEndpoints.length} of {availableEndpoints.length} available endpoints
          {assignedEndpoints.length > 0 && ` (${assignedEndpoints.length} already assigned)`}
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 w-12">
                <input
                  type="checkbox"
                  checked={filteredEndpoints.length > 0 && selectedEndpoints.size === filteredEndpoints.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Hostname
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Machine ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Heartbeat
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEndpoints.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  {availableEndpoints.length === 0 
                    ? 'All endpoints are already assigned to this job'
                    : 'No endpoints match your filters'}
                </td>
              </tr>
            ) : (
              filteredEndpoints.map((endpoint) => (
                <tr
                  key={endpoint.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => toggleEndpoint(endpoint.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedEndpoints.has(endpoint.id)}
                      onChange={() => toggleEndpoint(endpoint.id)}
                      className="rounded border-gray-300 dark:border-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {endpoint.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {endpoint.hostname}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {endpoint.platform}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {endpoint.machine_id ? endpoint.machine_id.substring(0, 12) + '...' : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        endpoint.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : endpoint.status === 'inactive'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {endpoint.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {endpoint.last_heartbeat
                      ? new Date(endpoint.last_heartbeat).toLocaleString()
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
