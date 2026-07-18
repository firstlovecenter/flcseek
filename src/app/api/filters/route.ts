import { NextRequest, NextResponse } from 'next/server';
import { FilterBuilder } from '@/lib/filter-builder';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

/**
 * GET /api/filters
 * Get filter presets and templates
 * Query: type='presets'|'templates'
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'presets';

    if (type === 'presets') {
      const presets = FilterBuilder.getFilterPresets();
      return NextResponse.json({
        success: true,
        type: 'presets',
        presets,
      });
    }

    if (type === 'templates') {
      const templates = FilterBuilder.getFilterTemplates();
      const templatesList = Object.entries(templates).map(([key, fn]) => ({
        id: key,
        name: key.replace(/_/g, ' ').toUpperCase(),
        filters: fn(),
      }));

      return NextResponse.json({
        success: true,
        type: 'templates',
        templates: templatesList,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid type parameter',
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error('GET /api/filters error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get filters',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/filters
 * Apply filters to get converts
 * Body: {filters, groupId?, sort?, dateRange?, limit?}
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const body = await request.json();
    const { filters, groupId, sort, dateRange, limit = 50, skip = 0 } = body;

    if (!filters || !Array.isArray(filters)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Filters array is required',
        },
        { status: 400 }
      );
    }

    // Validate filters
    const validation = FilterBuilder.validateFilters(filters);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid filters',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Apply date range if provided
    let allFilters = filters;
    if (dateRange) {
      allFilters = FilterBuilder.applyDateRange(filters, dateRange);
    }

    // Build where clause
    const where = FilterBuilder.buildWhereClause(allFilters, groupId);
    const orderBy = FilterBuilder.buildOrderBy(sort);

    // Execute query
    const [converts, total] = await Promise.all([
      prisma.newConvert.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          registeredBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.newConvert.count({
        where,
      }),
    ]);

    logger.info('Filters applied successfully', {
      userId,
      filterCount: filters.length,
      resultCount: converts.length,
      total,
    });

    return NextResponse.json({
      success: true,
      filters: filters.length,
      results: converts.length,
      total,
      hasMore: skip + converts.length < total,
      converts,
    });
  } catch (error) {
    logger.error('POST /api/filters error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to apply filters',
      },
      { status: 500 }
    );
  }
}
