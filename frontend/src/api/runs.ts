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

export const runsApi = {
  list: async (params?: { job_name?: string; page?: number; page_size?: number }): Promise<JobRun[]> => {
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
};
