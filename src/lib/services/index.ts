/**
 * Service layer — single import surface for domain/business logic.
 *
 * In the target architecture, route handlers are thin: they authenticate +
 * validate (via `withApiHandler`) and then delegate to a service. Services hold
 * the domain logic (analytics, badges, alerts, notifications, scoring, exports)
 * and depend only on the repository layer (`src/lib/db/queries/*`) — never on
 * `NextRequest`/`NextResponse`.
 *
 * These modules already existed at the `src/lib` root; this barrel groups them
 * under coherent namespaces so callers can `import { services } from '@/lib/services'`
 * (or import a single namespace) instead of reaching into ad-hoc file paths.
 */

export * as badges from '@/lib/achievement-badges';
export * as alerts from '@/lib/alert-management';
export * as cohorts from '@/lib/cohort-analysis';
export * as forecasting from '@/lib/growth-forecasting';
export * as predictions from '@/lib/predictive-analytics';
export * as milestoneAutoCalc from '@/lib/milestone-auto-calc';
export * as riskScoring from '@/lib/risk-scoring';
export * as notifications from '@/lib/notifications';
export * as leaderNotifications from '@/lib/leader-notifications';
export * as pushNotifications from '@/lib/push-notifications';
export * as savedSearches from '@/lib/saved-searches';
export * as reportTemplates from '@/lib/report-templates';
export * as bulkActions from '@/lib/bulk-actions';
export * as filterBuilder from '@/lib/filter-builder';
