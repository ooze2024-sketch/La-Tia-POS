import apiClient from './apiConfig';

export type SyncQueueStatus =
  | 'queued'
  | 'processing'
  | 'failed'
  | 'conflict'
  | 'synced'
  | 'cancelled';

export interface SyncQueueItem {
  id: number;
  transaction_reference?: string | null;
  device_id?: string | null;
  status: SyncQueueStatus;
  attempts: number;
  payload?: Record<string, any> | null;
  last_error?: string | null;
  last_attempt_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SyncQueueSummary {
  queued: number;
  processing: number;
  failed: number;
  conflict: number;
  synced: number;
  cancelled: number;
}

export interface SyncVersionInfo {
  version: string;
  updated_at?: string;
  server_time?: string;
}

const syncService = {
  getVersion: async (): Promise<SyncVersionInfo | null> => {
    const response = await apiClient.get('/sync/version');
    const rawData = response.data?.data || response.data || null;
    if (!rawData) {
      return null;
    }

    const version = rawData.version ?? rawData.catalog_version;
    return {
      version: version != null ? String(version) : "",
      updated_at: rawData.updated_at ?? rawData.timestamp,
      server_time: rawData.server_time ?? rawData.timestamp,
    };
  },

  getQueue: async (
    params?: { status?: SyncQueueStatus }
  ): Promise<SyncQueueItem[]> => {
    const response = await apiClient.get('/sync/queue', { params });
    return response.data?.data || [];
  },

  getSummary: async (): Promise<SyncQueueSummary | null> => {
    const response = await apiClient.get('/sync/queue/summary');
    return response.data?.data || null;
  },

  retryQueueItem: async (id: number): Promise<SyncQueueItem> => {
    const response = await apiClient.post(`/sync/queue/${id}/retry`);
    return response.data?.data;
  },

  cancelQueueItem: async (id: number): Promise<SyncQueueItem> => {
    const response = await apiClient.post(`/sync/queue/${id}/cancel`);
    return response.data?.data;
  },

  resolveConflict: async (
    id: number,
    resolutionData: {
      resolution: 'retry' | 'cancel' | 'force';
      note?: string;
    }
  ): Promise<SyncQueueItem> => {
    const response = await apiClient.post(
      `/sync/queue/${id}/resolve`,
      resolutionData
    );
    return response.data?.data;
  },
};

export default syncService;
