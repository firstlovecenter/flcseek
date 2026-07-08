import { Prisma } from '@prisma/client';
import { SearchFilter, SavedSearchFilters } from './types/advanced-features';
import { logger } from './logger';

type WhereClause = Prisma.NewConvertWhereInput;

/**
 * Filter builder for complex multi-field filtering
 * Supports text search, numeric comparisons, date ranges, and combinations
 */

export class FilterBuilder {
  /**
   * Build Prisma where clause from search filters
   */
  static buildWhereClause(filters: SearchFilter[], groupId?: string): WhereClause {
    const conditions: WhereClause[] = [];

    // Always exclude soft-deleted converts
    conditions.push({ deletedAt: null });

    // Add group filter if provided
    if (groupId) {
      conditions.push({
        groupId: groupId,
      });
    }

    // Process each filter
    for (const filter of filters) {
      const condition = this.buildFilterCondition(filter);
      if (condition) {
        conditions.push(condition);
      }
    }

    // Combine all conditions with AND
    if (conditions.length === 0) {
      return {};
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return {
      AND: conditions,
    };
  }

  /**
   * Build individual filter condition
   */
  private static buildFilterCondition(filter: SearchFilter): WhereClause | null {
    try {
      const { field, operator, value } = filter;

      // Handle nested fields (e.g., "user.firstName")
      const [parentField, childField] = field.split('.');

      switch (operator) {
        case 'equals':
          if (childField) {
            return {
              [parentField]: {
                [childField]: value,
              },
            };
          }
          return {
            [field]: value,
          };

        case 'contains':
          if (childField) {
            return {
              [parentField]: {
                [childField]: {
                  contains: value,
                  mode: 'insensitive',
                },
              },
            };
          }
          return {
            [field]: {
              contains: value,
              mode: 'insensitive',
            },
          };

        case 'gt':
          if (childField) {
            return {
              [parentField]: {
                [childField]: {
                  gt: value,
                },
              },
            };
          }
          return {
            [field]: {
              gt: value,
            },
          };

        case 'lt':
          if (childField) {
            return {
              [parentField]: {
                [childField]: {
                  lt: value,
                },
              },
            };
          }
          return {
            [field]: {
              lt: value,
            },
          };

        case 'gte':
          if (childField) {
            return {
              [parentField]: {
                [childField]: {
                  gte: value,
                },
              },
            };
          }
          return {
            [field]: {
              gte: value,
            },
          };

        case 'lte':
          if (childField) {
            return {
              [parentField]: {
                [childField]: {
                  lte: value,
                },
              },
            };
          }
          return {
            [field]: {
              lte: value,
            },
          };

        case 'in':
          if (childField) {
            return {
              [parentField]: {
                [childField]: {
                  in: Array.isArray(value) ? value : [value],
                },
              },
            };
          }
          return {
            [field]: {
              in: Array.isArray(value) ? value : [value],
            },
          };

        case 'between':
          if (!Array.isArray(value) || value.length !== 2) {
            logger.warn('Filter: between operator requires array of 2 values', {
              field,
              value,
            });
            return null;
          }

          if (childField) {
            return {
              [parentField]: {
                [childField]: {
                  gte: value[0],
                  lte: value[1],
                },
              },
            };
          }
          return {
            [field]: {
              gte: value[0],
              lte: value[1],
            },
          };

        default:
          logger.warn('Filter: Unknown operator', { operator });
          return null;
      }
    } catch (error) {
      logger.error('FilterBuilder: Error building condition', {
        filter,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Apply sorting to query
   */
  static buildOrderBy(
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Prisma.NewConvertFindManyArgs['orderBy'] | undefined {
    if (!sort || !sort.field) {
      return undefined;
    }

    const [parentField, childField] = sort.field.split('.');

    if (childField) {
      return {
        [parentField]: {
          [childField]: sort.order,
        },
      };
    }

    return {
      [sort.field]: sort.order,
    };
  }

  /**
   * Apply date range filter
   */
  static applyDateRange(
    filters: SearchFilter[],
    dateRange: { start: Date; end: Date } | undefined,
    dateField: string = 'createdAt'
  ): SearchFilter[] {
    if (!dateRange) {
      return filters;
    }

    return [
      ...filters,
      {
        field: dateField,
        operator: 'between',
        value: [dateRange.start, dateRange.end],
      },
    ];
  }

  /**
   * Get preset filters for common queries
   */
  static getFilterPresets() {
    return {
      active_converts: [
        {
          field: 'status',
          operator: 'equals',
          value: 'active',
        },
      ] as SearchFilter[],

      new_converts: [
        {
          field: 'status',
          operator: 'equals',
          value: 'new',
        },
      ] as SearchFilter[],

      at_risk: [
        {
          field: 'riskScore',
          operator: 'gte',
          value: 50,
        },
      ] as SearchFilter[],

      high_risk: [
        {
          field: 'riskScore',
          operator: 'gte',
          value: 75,
        },
      ] as SearchFilter[],

      inactive: [
        {
          field: 'status',
          operator: 'equals',
          value: 'inactive',
        },
      ] as SearchFilter[],

      no_recent_attendance: [
        {
          field: 'daysSinceLastAttendance',
          operator: 'gt',
          value: 30,
        },
      ] as SearchFilter[],

      milestone_stalled: [
        {
          field: 'daysSinceLastMilestone',
          operator: 'gt',
          value: 60,
        },
      ] as SearchFilter[],

      recently_added: [
        {
          field: 'createdAt',
          operator: 'gte',
          value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ] as SearchFilter[],
    };
  }

  /**
   * Validate filter configuration
   */
  static validateFilters(filters: SearchFilter[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const validOperators = ['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'in', 'between'];
    const validFields = [
      'id',
      'firstName',
      'lastName',
      'email',
      'phone',
      'status',
      'riskScore',
      'daysSinceLastAttendance',
      'daysSinceLastMilestone',
      'createdAt',
      'updatedAt',
      'user.firstName',
      'user.lastName',
      'user.email',
    ];

    for (const filter of filters) {
      if (!filter.field) {
        errors.push('Filter field is required');
      } else if (!validFields.includes(filter.field)) {
        errors.push(`Invalid filter field: ${filter.field}`);
      }

      if (!filter.operator) {
        errors.push('Filter operator is required');
      } else if (!validOperators.includes(filter.operator)) {
        errors.push(`Invalid filter operator: ${filter.operator}`);
      }

      if (filter.value === undefined || filter.value === null) {
        errors.push(`Filter value required for field: ${filter.field}`);
      }

      // Validate 'between' operator has 2 values
      if (filter.operator === 'between') {
        if (!Array.isArray(filter.value) || filter.value.length !== 2) {
          errors.push('Between operator requires array of 2 values');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Combine multiple filter sets with AND logic
   */
  static combineFilters(...filterSets: SearchFilter[][]): SearchFilter[] {
    return filterSets.flat();
  }

  /**
   * Get common filter templates
   */
  static getFilterTemplates() {
    return {
      high_need_group: () => [
        {
          field: 'riskScore',
          operator: 'gte',
          value: 50,
        },
        {
          field: 'daysSinceLastAttendance',
          operator: 'gt',
          value: 14,
        },
      ] as SearchFilter[],

      stable_performers: () => [
        {
          field: 'riskScore',
          operator: 'lte',
          value: 25,
        },
        {
          field: 'status',
          operator: 'equals',
          value: 'active',
        },
      ] as SearchFilter[],

      recent_activity: () => [
        {
          field: 'updatedAt',
          operator: 'gte',
          value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      ] as SearchFilter[],

      needs_follow_up: () => [
        {
          field: 'daysSinceLastAttendance',
          operator: 'gt',
          value: 21,
        },
        {
          field: 'status',
          operator: 'equals',
          value: 'active',
        },
      ] as SearchFilter[],
    };
  }
}

export type { SearchFilter, SavedSearchFilters };
