import { NextRequest, NextResponse } from 'next/server';
import { ReportTemplatesService } from '@/lib/report-templates';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api/middleware';

export async function POST(request: NextRequest) {
  try {
    // Get user from header
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    // Verify user is authorized
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, sections, isPublic = false } = body;

    if (!name || !sections) {
      return NextResponse.json(
        { error: 'name and sections required' },
        { status: 400 }
      );
    }

    const template = await ReportTemplatesService.createTemplate({
      name,
      description,
      sections,
      isPublic,
      createdById: userId,
    });

    logger.info('Report template created via API', {
      templateId: template.id,
      userId,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    logger.error('Create report template error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user from header
    const { user, error: authError } = requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const groupId = request.nextUrl.searchParams.get('groupId');
    const includePublic = request.nextUrl.searchParams.get('includePublic') !== 'false';

    const templates = await ReportTemplatesService.listTemplates(userId, includePublic);

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    logger.error('Get report templates error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
