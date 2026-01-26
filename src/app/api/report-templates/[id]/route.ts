import { NextRequest, NextResponse } from 'next/server';
import { ReportTemplatesService } from '@/lib/report-templates';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const template = await ReportTemplatesService.getTemplate(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    logger.error('Get report template error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is authorized
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const template = await ReportTemplatesService.updateTemplate(id, body);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    logger.info('Report template updated via API', {
      templateId: id,
      userId,
    });

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    logger.error('Update report template error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is authorized
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !['superadmin', 'leadpastor', 'overseer', 'admin', 'leader'].includes(user.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const success = await ReportTemplatesService.deleteTemplate(id);

    if (!success) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    logger.info('Report template deleted via API', {
      templateId: id,
      userId,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('Delete report template error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
