/**
 * Shared API response type definitions
 * These interfaces match the snake_case JSON shapes returned by the API routes.
 * Import from here instead of using `any[]` in page components.
 */

// ============================================================================
// Milestone
// ============================================================================

export interface MilestoneData {
  id: string;
  stage_number: number;
  stage_name: string;
  short_name?: string;
  description?: string;
  is_active: boolean;
  is_auto_calculated?: boolean;
  created_at?: string;
}

// ============================================================================
// Progress
// ============================================================================

export interface ProgressEntry {
  stage_number: number;
  stage_name: string;
  is_completed: boolean;
  date_completed?: string;
}

// ============================================================================
// Person / Convert (API snake_case shape)
// ============================================================================

export interface PersonApiData {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  phone_number: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  residential_location?: string;
  school_residential_location?: string;
  occupation_type?: string;
  group_id?: string;
  group_name?: string;
  group_year?: number;
  registered_by?: string;
  created_at: string;
  updated_at: string;
  // Stats (present when include=progress or include=stats)
  progress?: ProgressEntry[];
  attendance_count?: number;
  /** Count (stats include) or stage numbers (grid include). */
  completed_stages?: number | number[];
  progress_percentage?: number;
  attendance_percentage?: number;
}

// ============================================================================
// Group (API snake_case shape)
// ============================================================================

export interface GroupApiData {
  id: string;
  name: string;
  year: number;
  leader_id?: string;
  leader_name?: string;
  leader_full_name?: string;
  description?: string;
  archived: boolean;
  member_count?: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Attendance
// ============================================================================

export interface AttendanceRecord {
  id: string;
  person_id: string;
  date_attended: string;
  service_type?: string;
  notes?: string;
  created_at?: string;
}

// ============================================================================
// User
// ============================================================================

export interface UserApiData {
  id: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role: 'superadmin' | 'leadpastor' | 'overseer' | 'admin' | 'leader';
  group_id?: string;
  group_name?: string;
  phone_number?: string;
  created_at?: string;
}

// ============================================================================
// Superadmin converts stats (from /api/superadmin/converts/stats)
// ============================================================================

export interface ConvertStatsData {
  total?: number;
  by_month?: Record<string, number>;
  by_group?: Record<string, number>;
  by_gender?: Record<string, number>;
  active?: number;
  deleted?: number;
}

// ============================================================================
// Activity log entry
// ============================================================================

export interface ActivityLogEntry {
  id: string;
  action: string;
  entity?: string;
  entity_id?: string;
  user_id?: string;
  user_name?: string;
  details?: string;
  created_at: string;
}
