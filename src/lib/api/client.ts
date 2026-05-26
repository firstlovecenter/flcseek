/**
 * API Client for v1 endpoints
 * Provides typed, consistent access to all API endpoints
 *
 * Authentication is handled exclusively via the httpOnly `auth_token` cookie
 * sent automatically on every request through `credentials: 'include'`.
 * The JWT is no longer read from localStorage.
 */

type FetchOptions = Omit<RequestInit, 'headers'> & {
  params?: Record<string, string | number | boolean | undefined>;
};

interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
}

class APIClient {
  private baseUrl = '/api';

  private getHeaders(): HeadersInit {
    return { 'Content-Type': 'application/json' };
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
        credentials: 'include', // send httpOnly cookies automatically
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
        data: data?.data !== undefined ? data.data : data,
        meta: data?.meta,
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

  async post<T = any>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<APIResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      params,
    });
  }

  async put<T = any>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<APIResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      params,
    });
  }

  async patch<T = any>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<APIResponse<T>> {
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
      date_of_birth?: string;
      residential_location?: string;
      school_residential_location?: string;
      occupation_type?: string;
      address?: string;  // Legacy field
      group_id?: string;
      group_name?: string;
    }) => this.post('/people', data),

    update: (id: string, data: Partial<{
      first_name: string;
      last_name: string;
      phone_number: string;
      gender: string;
      date_of_birth: string;
      residential_location: string;
      school_residential_location: string;
      occupation_type: string;
      address: string;
      group_id: string;
      group_name: string;
    }>) => this.patch(`/people/${id}`, data),

    delete: (id: string) => this.delete(`/people/${id}`),

    bulkCreate: (people: Record<string, unknown>[], skipDuplicates = true) =>
      this.post('/people/bulk', { people, skipDuplicates }),
  };

  // ========== Groups ==========
  
  groups = {
    list: (params?: {
      active?: boolean;
      archived?: boolean;
      search?: string;
      year?: number;
    }) => this.get('/groups', params),

    get: (id: string) => this.get(`/groups/${id}`),

    create: (data: {
      name: string;
      leader_id?: string;
      description?: string;
    }) => this.post('/groups', data),

    update: (id: string, data: Partial<{
      name: string;
      leader_id: string;
      description: string;
      archived: boolean;
    }>) => this.patch(`/groups/${id}`, data),

    delete: (id: string) => this.delete(`/groups/${id}`),

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
      this.post('/attendance', { person_id: personId, date_attended: data.date_attended }),

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
    listAll: () => this.get('/superadmin/milestones'),

    create: (data: {
      stage_number: number;
      stage_name: string;
      short_name?: string;
      description?: string;
      is_active?: boolean;
    }) => this.post('/superadmin/milestones', data),

    updateDetails: (id: string, data: Partial<{
      stage_name: string;
      short_name: string;
      description: string;
    }>) => this.put('/superadmin/milestones', { id, ...data }),

    toggleActive: (id: string, is_active: boolean) =>
      this.patch('/superadmin/milestones', { id, is_active }),

    delete: (id: string) => this.delete('/superadmin/milestones', { id }),
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
