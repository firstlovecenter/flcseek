import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/api';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * DELETE — Soft-delete converts (sets deletedAt). Preserves progress/attendance.
 * Destructive purge is intentionally not exposed here.
 */
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(
    request,
    '/api/superadmin/converts/bulk-delete'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { user, error } = await requireSuperAdmin(request);
  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized — superadmin only' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { person_ids } = body as { person_ids: string[] };

    if (!person_ids || !Array.isArray(person_ids) || person_ids.length === 0) {
      return NextResponse.json(
        { error: 'No person IDs provided' },
        { status: 400 }
      );
    }

    const convertsToDelete = await prisma.newConvert.findMany({
      where: { id: { in: person_ids }, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const result = await prisma.newConvert.updateMany({
      where: { id: { in: person_ids }, deletedAt: null },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      deleted_count: result.count,
      deleted: convertsToDelete.map((c) => ({
        id: c.id,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      })),
    });
  } catch (err) {
    console.error('[bulk-delete]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
