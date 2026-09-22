import {
  AdminUserListResponse,
  AnalyticsOverviewResponse,
  ApiKeyCreatedResponse,
  ApiKeyListResponse,
  ApiKeyRead,
  AttachmentListResponse,
  AuditLog,
  AvailableTransition,
  Department,
  ThirdPartyTicketCreate,
  ThirdPartyTicketResponse,
  Ticket,
  TicketAttachment,
  TicketListResponse,
  TicketPriority,
  TicketState,
  TokenResponse,
  User,
  UserRole,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('access_token', token);
      } else {
        localStorage.removeItem('access_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        this.setToken(null);
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn(`API request to ${endpoint} failed:`, error.message);
      throw error;
    }
  }

  // ==========================================
  // Authentication
  // ==========================================
  async login(email: string, password: string): Promise<TokenResponse> {
    return this.request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async getUsers(params?: { department_id?: number; role?: UserRole }): Promise<User[]> {
    const query = new URLSearchParams();
    if (params?.department_id) query.set('department_id', params.department_id.toString());
    if (params?.role) query.set('role', params.role);
    return this.request<User[]>(`/auth/users?${query.toString()}`);
  }

  // ==========================================
  // Departments & Workflows
  // ==========================================
  async getDepartments(): Promise<Department[]> {
    return this.request<Department[]>('/workflows/departments');
  }

  // ==========================================
  // Tickets & Queues
  // ==========================================
  async getTickets(params?: {
    department_id?: number;
    state?: TicketState;
    priority?: TicketPriority;
    my_queue?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<TicketListResponse> {
    const query = new URLSearchParams();
    if (params?.department_id) query.set('department_id', params.department_id.toString());
    if (params?.state) query.set('state', params.state);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.my_queue) query.set('my_queue', 'true');
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    return this.request<TicketListResponse>(`/tickets/?${query.toString()}`);
  }

  async getTicket(id: number): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}`);
  }

  async createTicket(data: {
    title: string;
    description: string;
    priority: TicketPriority;
    department_id: number;
    metadata_payload?: Record<string, any>;
  }): Promise<Ticket> {
    return this.request<Ticket>('/tickets/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTicket(
    id: number,
    data: {
      title?: string;
      description?: string;
      priority?: TicketPriority;
      assignee_id?: number | null;
      metadata_payload?: Record<string, any>;
      comment?: string;
    }
  ): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async transitionTicket(
    id: number,
    data: {
      target_state: TicketState;
      comment?: string;
      metadata_patch?: Record<string, any>;
    }
  ): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getNextTransitions(id: number): Promise<AvailableTransition[]> {
    return this.request<AvailableTransition[]>(`/tickets/${id}/next-transitions`);
  }

  async getAuditTrail(id: number): Promise<AuditLog[]> {
    return this.request<AuditLog[]>(`/tickets/${id}/audit-trail`);
  }

  async addComment(
    ticketId: number,
    data: { comment: string; is_internal: boolean }
  ): Promise<AuditLog> {
    return this.request<AuditLog>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // Attachments & Evidence
  // ==========================================
  async getAttachments(ticketId: number): Promise<AttachmentListResponse> {
    return this.request<AttachmentListResponse>(`/tickets/${ticketId}/attachments`);
  }

  async uploadAttachment(ticketId: number, file: File): Promise<TicketAttachment> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      this.setToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Upload failed with status ${response.status}`);
    }

    return await response.json();
  }

  async deleteAttachment(attachmentId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  getAttachmentDownloadUrl(attachmentId: number): string {
    return `${API_BASE_URL}/attachments/${attachmentId}/download`;
  }

  // ==========================================
  // Executive Analytics
  // ==========================================
  async getAnalyticsOverview(
    days: number = 30,
    departmentId?: number
  ): Promise<AnalyticsOverviewResponse> {
    const query = new URLSearchParams();
    query.set('days', days.toString());
    if (departmentId) {
      query.set('department_id', departmentId.toString());
    }
    return this.request<AnalyticsOverviewResponse>(`/analytics/overview?${query.toString()}`);
  }

  async smartClassifyTicket(data: { title: string; description: string }): Promise<any> {
    return this.request<any>('/ai/smart-classify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRecurringWorkflows(): Promise<any[]> {
    return this.request<any[]>('/recurring/');
  }

  // ==========================================
  // AI Email Ingestion & Task Reader
  // ==========================================
  async getEmailPendingActions(): Promise<any> {
    return this.request<any>('/emails/pending-actions');
  }

  async convertEmailToTicket(emailId: string): Promise<any> {
    return this.request<any>(`/emails/${emailId}/convert-to-ticket`, {
      method: 'POST',
    });
  }

  async markEmailResolved(emailId: string): Promise<any> {
    return this.request<any>(`/emails/${emailId}/mark-resolved`, {
      method: 'POST',
    });
  }

  async syncEmailInbox(): Promise<any> {
    return this.request<any>('/emails/sync', {
      method: 'POST',
    });
  }

  // ==========================================
  // Super Admin User Management
  // ==========================================
  async adminGetUsers(params?: {
    page?: number;
    limit?: number;
    department_id?: number;
    role?: UserRole;
    is_active?: boolean;
    search?: string;
  }): Promise<AdminUserListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.department_id !== undefined) query.set('department_id', params.department_id.toString());
    if (params?.role) query.set('role', params.role);
    if (params?.is_active !== undefined) query.set('is_active', params.is_active.toString());
    if (params?.search) query.set('search', params.search);

    return this.request<AdminUserListResponse>(`/admin/users?${query.toString()}`);
  }

  async adminCreateUser(data: {
    email: string;
    full_name: string;
    password: string;
    role: UserRole;
    department_id?: number | null;
    is_active?: boolean;
  }): Promise<User> {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateUser(
    userId: number,
    data: {
      email?: string;
      full_name?: string;
      role?: UserRole;
      department_id?: number | null;
      is_active?: boolean;
      password?: string;
    }
  ): Promise<User> {
    return this.request<User>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // Developer API Keys & Third-Party Gateway
  // ==========================================
  async adminGetApiKeys(): Promise<ApiKeyListResponse> {
    return this.request<ApiKeyListResponse>('/admin/api-keys');
  }

  async adminCreateApiKey(data: {
    name: string;
    department_id?: number | null;
  }): Promise<ApiKeyCreatedResponse> {
    return this.request<ApiKeyCreatedResponse>('/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteApiKey(apiKeyId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/api-keys/${apiKeyId}`, {
      method: 'DELETE',
    });
  }

  async createThirdPartyTicket(
    data: ThirdPartyTicketCreate,
    apiKey: string
  ): Promise<ThirdPartyTicketResponse> {
    const response = await fetch(`${API_BASE_URL}/integrations/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Ingestion failed with status ${response.status}`);
    }

    return await response.json();
  }
}

export const api = new ApiClient();



