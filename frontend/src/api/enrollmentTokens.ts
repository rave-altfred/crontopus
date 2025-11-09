import { apiClient } from './client';

export interface EnrollmentToken {
  id: number;
  name: string;
  used_count: number;
  max_uses: number | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface EnrollmentTokenCreate {
  name: string;
  expires_in_days?: number;
  max_uses?: number;
}

export interface EnrollmentTokenResponse {
  token: string;
  token_record: EnrollmentToken;
}

export const enrollmentTokensApi = {
  async create(data: EnrollmentTokenCreate): Promise<EnrollmentTokenResponse> {
    const response = await apiClient.post('/enrollment-tokens', data);
    return response.data;
  },

  async list(): Promise<EnrollmentToken[]> {
    const response = await apiClient.get('/enrollment-tokens');
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/enrollment-tokens/${id}`);
  },
};
