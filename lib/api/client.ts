/**
 * API Client for v1 endpoints
 * Provides typed, consistent access to all API endpoints
 */

// Get auth token from localStorage (client-side only)
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

type FetchOptions = Omit<RequestInit, 'headers'> & {
  params?: Record<string, string | number | boolean | undefined>;
};

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
}

class APIClient {
  private baseUrl = '/api/v1';

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.pathname + url.search;
  }

  async request<T = any>(path: string, options: FetchOptions = {}): Promise<APIResponse<T>> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: this.getHeaders(),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: 'UNKNOWN_ERROR',
            message: data.message || 'An unexpected error occurred',
          },
        };
      }

      return {
        success: true,
        data: data.data,
        meta: data.meta,
      };
    } catch (err) {
      console.error(`[API ${options.method || 'GET'}] ${path}:`, err);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server',
        },
      };
    }
  }

  async get<T = any>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<APIResponse<T>> {
    return this.request<T>(path, { method: 'GET', params });
  }

  async post<T = any>(path: string, body?: any, params?: Record<string, string | number | boolean | undefined>): Promise<APIResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      params,
    });
  }

  async patch<T = any>(path: string, body?: any, params?: Record<string, string | number | boolean | undefined>): Promise<APIResponse<T>> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      params,
    });
  }

  async delete<T = any>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<APIResponse<T>> {
    return this.request<T>(path, { method: 'DELETE', params });
  }

  // ========== People ==========
  
  people = {
    list: (params?: {
      group_id?: string;
      year?: number;
      month?: string;
      search?: string;
      limit?: number;
      offset?: number;
      include?: string; // 'progress' | 'stats'
    }) => this.get('/people', params),

    get: (id: string) => this.get(`/people/${id}`),

    create: (data: {
      first_name: string;
      last_name: string;
      phone_number: string;
      gender?: 'Male' | 'Female';
      address?: string;
      group_id?: string;
      group_name?: string;
    }) => this.post('/people', data),

    update: (id: string, data: Partial<{
      first_name: string;
      last_name: string;
      phone_number: string;
      gender: string;
      address: string;
      group_id: string;
      group_name: string;
    }>) => this.patch(`/people/${id}`, data),

    delete: (id: string) => this.delete(`/people/${id}`),

    bulkCreate: (people: any[], skipDuplicates = true) =>
      this.post('/people/bulk', { people, skipDuplicates }),
  };

  // ========== Groups ==========
  
  groups = {
    list: (params?: {
      year?: number;
      active?: boolean;
      search?: string;
    }) => this.get('/groups', params),

    get: (id: string) => this.get(`/groups/${id}`),

    create: (data: {
      name: string;
      year: number;
      leader_id?: string;
      description?: string;
    }) => this.post('/groups', data),

    update: (id: string, data: Partial<{
      name: string;
      year: number;
      leader_id: string;
      description: string;
      is_active: boolean;
    }>) => this.patch(`/groups/${id}`, data),

    delete: (id: string) => this.delete(`/groups/${id}`),

    cloneYear: (targetYear?: number) =>
      this.post('/groups/clone-year', { targetYear }),
  };

  // ========== Users ==========
  
  users = {
    list: (params?: {
      role?: string;
      search?: string;
    }) => this.get('/users', params),

    get: (id: string) => this.get(`/users/${id}`),

    create: (data: {
      username: string;
      password: string;
      role: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      group_id?: string;
      group_name?: string;
    }) => this.post('/users', data),

    update: (id: string, data: Partial<{
      password: string;
      role: string;
      email: string;
      first_name: string;
      last_name: string;
      phone_number: string;
      group_id: string;
      group_name: string;
    }>) => this.patch(`/users/${id}`, data),

    delete: (id: string) => this.delete(`/users/${id}`),

    getLeaders: () => this.get('/users/leaders'),
  };

  // ========== Progress ==========
  
  progress = {
    getForPerson: (personId: string) => this.get(`/progress/${personId}`),

    update: (personId: string, data: {
      stage_number: number;
      is_completed: boolean;
    }) => this.patch(`/progress/${personId}`, data),
  };

  // ========== Attendance ==========
  
  attendance = {
    list: (params?: {
      person_id?: string;
      group_id?: string;
      start_date?: string;
      end_date?: string;
    }) => this.get('/attendance', params),

    create: (data: {
      person_id: string;
      date_attended: string;
      service_type?: string;
      notes?: string;
    }) => this.post('/attendance', data),

    mark: (personId: string, data: { date_attended: string }) =>
      this.post(`/attendance/${personId}`, data),

    bulkCreate: (records: Array<{
      person_id: string;
      date_attended: string;
      service_type?: string;
      notes?: string;
    }>) => this.post('/attendance', { records }),
  };

  // ========== Milestones ==========
  
  milestones = {
    list: (includeInactive = false) =>
      this.get('/milestones', { include_inactive: includeInactive }),

    // Admin operations
    listAll: () => this.get('/admin/milestones'),

    create: (data: {
      stage_number: number;
      stage_name: string;
      short_name?: string;
      description?: string;
      is_active?: boolean;
    }) => this.post('/admin/milestones', data),

    update: (id: string, data: Partial<{
      stage_name: string;
      short_name: string;
      description: string;
      is_active: boolean;
    }>) => this.patch('/admin/milestones', data, { id }),
  };

  // ========== Stats ==========
  
  stats = {
    getDashboard: (params?: {
      group_id?: string;
      year?: number;
    }) => this.get('/stats', params),
  };
}

// Export singleton instance
export const api = new APIClient();

// Export types
export type { APIResponse };
