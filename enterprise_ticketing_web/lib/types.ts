export type UserRole = 'REQUESTER' | 'ASSIGNEE' | 'AUTHORIZER' | 'OBSERVER' | 'ADMIN';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';

export type TicketState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export type AuditAction =
  | 'CREATED'
  | 'FIELD_UPDATED'
  | 'STATE_TRANSITION'
  | 'ASSIGNED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMMENT_ADDED';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  department_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  priority: TicketPriority;
  current_state: TicketState;
  department_id: number;
  creator_id: number;
  assignee_id?: number | null;
  metadata_payload: Record<string, any>;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  creator?: User | null;
  assignee?: User | null;
  department?: Department | null;
}

export interface WorkflowStep {
  id: number;
  department_id: number;
  name: string;
  from_state: TicketState;
  to_state: TicketState;
  required_role: UserRole;
  step_order: number;
  condition_rules: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface AvailableTransition {
  step_id: number;
  name: string;
  from_state: TicketState;
  to_state: TicketState;
  required_role: UserRole;
  condition_rules: Record<string, any>;
  is_allowed: boolean;
  reason?: string | null;
}

export interface AuditLog {
  id: number;
  ticket_id: number;
  actor_id?: number | null;
  action: AuditAction;
  from_state?: TicketState | null;
  to_state?: TicketState | null;
  comment?: string | null;
  payload: Record<string, any>;
  created_at: string;
  actor?: User | null;
}

export interface TicketListResponse {
  total: number;
  items: Ticket[];
  page: number;
  limit: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TriageResponse {
  suggested_department_code: string;
  suggested_priority: TicketPriority;
  extracted_tags: string[];
  confidence_score: number;
  suggested_first_response: string;
  key_entities: Record<string, any>;
}

export interface RecurringWorkflow {
  id: number;
  title: string;
  description: string;
  department_id: number;
  cron_expression: string;
  priority: TicketPriority;
  metadata_template: Record<string, any>;
  creator_id?: number | null;
  is_active: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
  department?: Department | null;
  creator?: User | null;
}

export interface EmailTaskItem {
  id: string;
  sender: string;
  sender_name: string;
  subject: string;
  body: string;
  timestamp: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  is_action_required: boolean;
  summary: string;
  suggested_department: string;
  status: 'PENDING' | 'CONVERTED' | 'RESOLVED';
  converted_ticket_id?: number | null;
  converted_ticket_number?: string | null;
}

export interface PendingEmailsResponse {
  critical_count: number;
  high_count: number;
  medium_count: number;
  normal_count: number;
  total_pending: number;
  items: EmailTaskItem[];
}

export interface ConvertEmailResponse {
  status: string;
  message: string;
  ticket_id: number;
  ticket_number: string;
  department_code: string;
  priority: string;
  email_id: string;
}

export interface MarkResolvedResponse {
  status: string;
  message: string;
  email_id: string;
}

export interface AdminUserListResponse {
  total: number;
  items: User[];
  page: number;
  limit: number;
}

