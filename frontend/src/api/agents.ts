import { apiClient } from './client';

export interface Agent {
  id: number;
  name: string;
  hostname: string;
  platform: string;
  version: string;
  status: 'active' | 'inactive' | 'offline';
  last_heartbeat: string;
  enrolled_at: string;
  git_repo_url: string;
  git_repo_branch: string;
  machine_id: string | null;
}

export interface JobInstance {
  id: number;
  job_name: string;
  namespace: string;
  endpoint_id: number;
  status: string;
  source: string;
  original_command: string | null;
  last_seen: string;
}

export const agentsApi = {
  list: async (): Promise<Agent[]> => {
    const response = await apiClient.get('/agents');
    return response.data.agents || [];
  },

  get: async (id: number): Promise<Agent> => {
    const response = await apiClient.get(`/agents/${id}`);
    return response.data;
  },

  revoke: async (id: number): Promise<void> => {
    await apiClient.delete(`/agents/${id}`);
  },

  rename: async (id: number, name: string): Promise<Agent> => {
    const response = await apiClient.patch(`/endpoints/${id}?name=${encodeURIComponent(name)}`);
    return response.data;
  },

  getJobs: async (endpointId: number | string): Promise<JobInstance[]> => {
    const response = await apiClient.get(`/endpoints/${endpointId}/jobs`);
    return response.data.jobs || [];
  },

  assignJob: async (endpointId: number | string, jobName: string, namespace: string = 'production'): Promise<void> => {
    await apiClient.post(`/endpoints/${endpointId}/assign-job`, {
      job_name: jobName,
      namespace: namespace
    });
  },

  unassignJob: async (endpointId: number | string, namespace: string, jobName: string): Promise<void> => {
    await apiClient.delete(`/endpoints/${endpointId}/jobs/${namespace}/${jobName}`);
  },
};
