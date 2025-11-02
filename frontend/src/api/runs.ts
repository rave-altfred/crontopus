import { apiClient } from './client';

export interface JobRun {
  id: string;
  job_name: string;
  status: 'success' | 'failure' | 'timeout';
  output: string | null;
  error: string | null;
  started_at: string;
  finished_at: string;
  duration_seconds: number | null;
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
