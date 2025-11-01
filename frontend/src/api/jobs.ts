import { apiClient } from './client';

export interface JobManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    tenant?: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    schedule: string;
    timezone?: string;
    command: string;
    args?: string[];
    workingDir?: string;
    env?: Record<string, string>;
    enabled?: boolean;
    paused?: boolean;
  };
  _meta?: {
    file_path: string;
    namespace: string;
    raw_content: string;
  };
}

export interface JobListItem {
  name: string;
  path: string;
  namespace: string;
  size: number;
  sha: string;
}

export interface JobsListResponse {
  jobs: JobListItem[];
  count: number;
  source: string;
  repository: string;
}

export interface JobDetailResponse {
  manifest: JobManifest;
  valid: boolean;
  error: string | null;
  source: string;
  path?: string;
  namespace?: string;
  name?: string;
}

export interface JobCreatePayload {
  name: string;
  namespace: string;
  schedule: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  paused?: boolean;
  timezone?: string;
  labels?: Record<string, string>;
}

export const jobsApi = {
  list: async (namespace?: string): Promise<JobsListResponse> => {
    const params = namespace ? { namespace } : {};
    const response = await apiClient.get('/jobs', { params });
    return response.data;
  },

  get: async (jobPath: string): Promise<JobDetailResponse> => {
    const response = await apiClient.get(`/jobs/${jobPath}`);
    return response.data;
  },

  getByName: async (namespace: string, jobName: string): Promise<JobDetailResponse> => {
    const response = await apiClient.get(`/jobs/${namespace}/${jobName}`);
    return response.data;
  },

  create: async (job: JobCreatePayload): Promise<any> => {
    const response = await apiClient.post('/jobs', job);
    return response.data;
  },
};
