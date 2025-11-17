import { apiClient } from './client';

export interface APIToken {
  id: number;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_expired: boolean;
}

export interface APITokenCreate {
  name: string;
  scopes: string[];
  expires_days?: number;
}

export interface APITokenCreateResponse extends APIToken {
  token: string; // Only returned once during creation
}

export interface APITokenUpdate {
  name?: string;
  expires_days?: number;
}

export interface APITokenListResponse {
  tokens: APIToken[];
  total: number;
  page: number;
  page_size: number;
}

export const apiTokensApi = {
  async list(page = 1, page_size = 50): Promise<APITokenListResponse> {
    const response = await apiClient.get<APITokenListResponse>('/tokens', {
      params: { page, page_size },
    });
    return response.data;
  },

  async get(id: number): Promise<APIToken> {
    const response = await apiClient.get<APIToken>(`/tokens/${id}`);
    return response.data;
  },

  async create(data: APITokenCreate): Promise<APITokenCreateResponse> {
    const response = await apiClient.post<APITokenCreateResponse>('/tokens', data);
    return response.data;
  },

  async update(id: number, data: APITokenUpdate): Promise<APIToken> {
    const response = await apiClient.patch<APIToken>(`/tokens/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/tokens/${id}`);
  },
};

// Available scopes for display
export const AVAILABLE_SCOPES = [
  { value: 'read:runs', label: 'Read Runs', description: 'View job run history' },
  { value: 'write:jobs', label: 'Write Jobs', description: 'Create, update, delete jobs' },
  { value: 'read:jobs', label: 'Read Jobs', description: 'View jobs' },
  { value: 'read:agents', label: 'Read Agents', description: 'View agents/endpoints' },
  { value: 'write:agents', label: 'Write Agents', description: 'Enroll, update, delete agents' },
  { value: 'read:tokens', label: 'Read Tokens', description: 'View API tokens' },
  { value: 'write:tokens', label: 'Write Tokens', description: 'Create, update, delete API tokens' },
  { value: 'admin:*', label: 'Admin (All)', description: 'All permissions' },
];
