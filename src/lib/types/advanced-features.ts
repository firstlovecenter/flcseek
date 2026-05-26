/**
 * TypeScript type definitions for advanced features
 * Phase 1: Database Schema & Backend Foundation
 */

// ============================================================================
// Achievement Badges Types
// ============================================================================

export type BadgeCriteriaType = 
  | 'attendance'    // Based on attendance count/percentage
  | 'milestones'    // Based on milestone completion
  | 'streak'        // Based on consecutive attendance/milestones
  | 'milestone_complete' // All milestones completed
  | 'custom';       // Custom criteria

export interface BadgeCriteria {
  type: BadgeCriteriaType;
  threshold: number;
  period?: '6_months' | 'year' | 'all_time';
  metric?: string;
  [key: string]: unknown;
}

export interface AchievementBadge {
  id: string;
  name: string;
  description?: string;
  criteria: BadgeCriteria;
  icon?: string;
  color?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface UserBadge {
  id: string;
  userId?: string;
  convertId?: string;
  badgeId: string;
  earnedAt: Date;
  metadata?: Record<string, any>;
  badge?: AchievementBadge;
}

// ============================================================================
// Alert System Types
// ============================================================================

export type AlertType = 
  | 'attendance_drop'   // Declining attendance
  | 'milestone_stall'   // No milestone progress
  | 'missing'          // Extended absence
  | 'high_risk'        // High risk score
  | 'custom';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface AlertCriteria {
  metric: string;
  threshold: number;
  period?: string;
  comparison?: 'above' | 'below' | 'equals';
  [key: string]: unknown;
}

export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  criteria: AlertCriteria;
  notificationChannels?: NotificationChannel[];
  isActive: boolean;
  createdAt: Date;
}

export interface ConvertAlert {
  id: string;
  convertId: string;
  alertRuleId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  alertRule?: AlertRule;
  convert?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// ============================================================================
// Saved Searches Types
// ============================================================================

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
  value: string | number | Date | string[] | Date[] | boolean | undefined;
}

export interface SavedSearchFilters {
  filters: SearchFilter[];
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  [key: string]: unknown;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  description?: string;
  filters: SavedSearchFilters;
  isSmart: boolean;      // Dynamic filters that auto-update
  isPublic: boolean;     // Shareable with team
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Report Templates Types
// ============================================================================

export type ReportSection = 
  | 'summary'
  | 'attendance'
  | 'milestones'
  | 'performance'
  | 'alerts'
  | 'trends'
  | 'predictions'
  | 'cohorts';

export interface ReportMetric {
  id: string;
  name: string;
  type: 'count' | 'percentage' | 'average' | 'trend';
  format?: 'number' | 'percentage' | 'currency' | 'duration';
}

export interface ReportTemplateConfig {
  sections: ReportSection[];
  metrics: ReportMetric[];
  filters?: SavedSearchFilters;
  groupBy?: string[];
  dateRange?: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  visualization?: {
    charts: string[];
    layout: 'grid' | 'list';
  };
  [key: string]: unknown;
}

export interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;   // 0-6 for weekly
  dayOfMonth?: number;  // 1-31 for monthly
  time?: string;        // HH:mm format
  recipients?: string[];
  format?: 'pdf' | 'csv' | 'xlsx';
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  templateConfig: ReportTemplateConfig;
  scheduleConfig?: ScheduleConfig;
  createdBy: string;
  isPublic: boolean;
  createdAt: Date;
}

// ============================================================================
// Analytics Snapshots Types
// ============================================================================

export interface AnalyticsMetrics {
  totalConverts: number;
  activeConverts: number;
  attendanceRate: number;
  averageMilestones: number;
  completionRate: number;
  riskDistribution?: {
    low: number;
    medium: number;
    high: number;
  };
  trends?: {
    attendance: number;    // % change
    milestones: number;    // % change
    completion: number;    // % change
  };
  [key: string]: unknown;
}

export interface AnalyticsSnapshot {
  id: string;
  snapshotDate: Date;
  groupId?: string;
  metrics: AnalyticsMetrics;
  createdAt: Date;
}

// ============================================================================
// Risk Scoring Types
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskFactors {
  attendanceScore: number;      // 0-100
  milestoneScore: number;       // 0-100
  engagementScore: number;      // 0-100
  timeScore: number;            // 0-100
  weights?: {
    attendance: number;
    milestones: number;
    engagement: number;
    time: number;
  };
}

export interface RiskAssessment {
  convertId: string;
  overallScore: number;         // 0-100
  level: RiskLevel;
  factors: RiskFactors;
  recommendations: string[];
  calculatedAt: Date;
}

// ============================================================================
// Auto-Trigger Configuration Types
// ============================================================================

export interface AutoTriggerCondition {
  type: 'attendance_count' | 'time_elapsed' | 'previous_milestone' | 'custom';
  value: number | string;
  operator?: 'equals' | 'gte' | 'lte';
}

export interface AutoTriggerConfig {
  enabled: boolean;
  conditions: AutoTriggerCondition[];
  logic?: 'AND' | 'OR';  // How to combine multiple conditions
  notifyLeaders?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Bulk Operations Types
// ============================================================================

export type BulkOperationType = 
  | 'update_milestone'
  | 'mark_attendance'
  | 'assign_badge'
  | 'update_risk_score'
  | 'archive'
  | 'restore';

export interface BulkOperation {
  type: BulkOperationType;
  convertIds: string[];
  data: Record<string, any>;
  performedBy: string;
  timestamp: Date;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{
    convertId: string;
    error: string;
  }>;
}

// ============================================================================
// Predictive Analytics Types
// ============================================================================

export interface PredictionModel {
  type: 'completion_probability' | 'dropout_risk' | 'engagement_forecast';
  accuracy?: number;
  lastTrained?: Date;
}

export interface ConvertPrediction {
  convertId: string;
  completionProbability: number;  // 0-1
  dropoutRisk: number;            // 0-1
  expectedCompletionDate?: Date;
  confidenceLevel: number;        // 0-1
  factors: string[];
}

// ============================================================================
// Cohort Analysis Types
// ============================================================================

export interface Cohort {
  id: string;
  name: string;
  definition: {
    startDate: Date;
    endDate: Date;
    criteria?: Record<string, any>;
  };
  size: number;
  metrics: {
    retentionRate: number;
    avgMilestones: number;
    completionRate: number;
  };
}

export interface CohortComparison {
  cohorts: Cohort[];
  metrics: string[];
  visualization: 'line' | 'bar' | 'heatmap';
}
