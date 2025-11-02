import { apiClient } from './client';

export interface Agent {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  version: string;
  status: 'active' | 'inactive' | 'offline';
  last_heartbeat: string;
  enrolled_at: string;
  git_repo_url: string;
  git_repo_branch: string;
}

export const agentsApi = {
  list: async (): Promise<Agent[]> => {
    const response = await apiClient.get('/agents');
    return response.data.agents || [];
  },

  get: async (id: string): Promise<Agent> => {
    const response = await apiClient.get(`/agents/${id}`);
    return response.data;
  },

  revoke: async (id: string): Promise<void> => {
    await apiClient.delete(`/agents/${id}`);
  },
};
