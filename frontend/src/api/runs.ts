import { apiClient } from './client';

export interface JobRun {
  id: number;
  job_name: string;
  namespace: string | null;
  status: 'success' | 'failure' | 'timeout' | 'running' | 'cancelled';
  output: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string;
  duration: number | null;
  exit_code: number | null;
  endpoint_id: number | null;
  agent_id: string | null;
}

export interface JobAggregation {
  job_name: string;
  namespace: string;
  endpoint_count: number;
  run_count: number;
  success_count: number;
  failure_count: number;
  health: 'healthy' | 'degraded' | 'warning';
}

export interface EndpointAggregation {
  id: number;
  name: string;
  hostname: string | null;
  platform: string;
  machine_id: string;
  version: string;
  run_count: number;
  success_count: number;
  failure_count: number;
  health: 'healthy' | 'degraded' | 'warning';
}

export const runsApi = {
  list: async (params?: {
    limit?: number;
    job_name?: string;
    namespace?: string;
    endpoint_id?: number;
    status?: string;
    days?: number;
  }): Promise<JobRun[]> => {
    const response = await apiClient.get('/runs', { params });
    return response.data.runs || [];
  },

  get: async (id: string): Promise<JobRun> => {
    const response = await apiClient.get(`/runs/${id}`);
    return response.data;
  },

  listByJob: async (jobName: string): Promise<JobRun[]> => {
    const response = await apiClient.get(`/runs/job/${jobName}`);
    return response.data;
  },

  aggregatedByJob: async (params?: {
    days?: number;
    job_name?: string;
    namespace?: string;
    endpoint_id?: number;
    status?: string;
  }): Promise<JobAggregation[]> => {
    const response = await apiClient.get('/runs/by-job', { params });
    return response.data.jobs || [];
  },

  aggregatedByEndpoint: async (params?: {
    days?: number;
    name?: string;
    hostname?: string;
    platform?: string;
    machine_id?: string;
  }): Promise<EndpointAggregation[]> => {
    const response = await apiClient.get('/runs/by-endpoint', { params });
    return response.data.endpoints || [];
  },
};
