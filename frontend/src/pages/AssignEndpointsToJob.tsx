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
    return <div className="text-gray-600 dark:text-[#6272a4]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/jobs/${namespace}/${jobName}`}
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
            ASSIGN ENDPOINTS: {jobName}
          </h2>
          <p className="text-sm font-mono text-gray-500 dark:text-[#6272a4] mt-1">
            // Select endpoints to run this job. Already assigned endpoints are hidden.
          </p>
        </div>
        <button
          onClick={handleAssign}
          disabled={assigning || selectedEndpoints.size === 0}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {assigning ? 'ASSIGNING...' : `ASSIGN ${selectedEndpoints.size} ENDPOINT${selectedEndpoints.size !== 1 ? 'S' : ''}`}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, hostname, or machine ID..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Platform Filter */}
          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Platform
            </label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">ALL PLATFORMS</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>{platform.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">ALL STATUSES</option>
              <option value="active">ACTIVE</option>
              <option value="inactive">INACTIVE</option>
              <option value="revoked">REVOKED</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-xs font-mono text-gray-600 dark:text-[#6272a4]">
          SHOWING {filteredEndpoints.length} OF {availableEndpoints.length} AVAILABLE ENDPOINTS
          {assignedEndpoints.length > 0 && ` (${assignedEndpoints.length} ALREADY ASSIGNED)`}
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-[#44475a]">
          <thead className="bg-gray-50 dark:bg-[#21222c]">
            <tr>
              <th className="px-6 py-3 w-12">
                <input
                  type="checkbox"
                  checked={filteredEndpoints.length > 0 && selectedEndpoints.size === filteredEndpoints.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] focus:ring-blue-500"
                />
              </th>
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
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
                Last Heartbeat
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#282a36] divide-y divide-gray-200 dark:divide-[#44475a]">
            {filteredEndpoints.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-[#6272a4] font-mono text-sm">
                  {availableEndpoints.length === 0 
                    ? 'ALL ENDPOINTS ARE ALREADY ASSIGNED TO THIS JOB'
                    : 'NO ENDPOINTS MATCH YOUR FILTERS'}
                </td>
              </tr>
            ) : (
              filteredEndpoints.map((endpoint) => (
                <tr
                  key={endpoint.id}
                  className="hover:bg-gray-50 dark:hover:bg-[#21222c] cursor-pointer transition-colors"
                  onClick={() => toggleEndpoint(endpoint.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedEndpoints.has(endpoint.id)}
                      onChange={() => toggleEndpoint(endpoint.id)}
                      className="rounded border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                      {endpoint.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {endpoint.hostname}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                      {endpoint.platform}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-gray-500 dark:text-[#6272a4]">
                      {endpoint.machine_id ? endpoint.machine_id.substring(0, 12) + '...' : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 text-xs font-mono border ${
                        endpoint.status === 'active'
                          ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400'
                          : endpoint.status === 'inactive'
                          ? 'border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400'
                          : 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                      }`}
                    >
                      {endpoint.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    {endpoint.last_heartbeat
                      ? new Date(endpoint.last_heartbeat).toLocaleString()
                      : 'NEVER'}
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
