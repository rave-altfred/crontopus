import { apiClient } from './client';

export interface Namespace {
  name: string;
  is_system: boolean;
  job_count: number;
}

export interface NamespaceCreatePayload {
  name: string;
}

export const namespacesApi = {
  list: async (): Promise<Namespace[]> => {
    const response = await apiClient.get('/namespaces/');
    return response.data;
  },

  create: async (namespace: NamespaceCreatePayload): Promise<Namespace> => {
    const response = await apiClient.post('/namespaces/', namespace);
    return response.data;
  },

  delete: async (name: string): Promise<void> => {
    await apiClient.delete(`/namespaces/${name}`);
  },
};
