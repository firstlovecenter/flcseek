import { NextRequest, NextResponse } from 'next/server';
import { ReportTemplatesService } from '@/lib/report-templates';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/api/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from header
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const userId = user!.id;

    const { id } = await params;
    const { groupId, format = 'json' } = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'groupId required' }, { status: 400 });
    }

    if (format === 'json') {
      // Return report data as JSON
      const data = await ReportTemplatesService.generateReportData(id, groupId);
      if (!data) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json(data, { status: 200 });
    } else if (format === 'pdf') {
      // Generate PDF
      const data = await ReportTemplatesService.generateReportData(id, groupId);
      if (!data) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const pdfBuffer = await ReportTemplatesService.generatePDFReport(id, groupId, data);
      if (!pdfBuffer) {
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
      }

      logger.info('Report generated as PDF', {
        templateId: id,
        groupId,
        userId,
      });

      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename=report.pdf',
        },
      });
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Generate report error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
