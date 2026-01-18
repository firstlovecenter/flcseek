import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; username: string };
    // Only allow skaduteye and sysadmin superadmins
    if (decoded.role !== 'superadmin' || !['skaduteye', 'sysadmin'].includes(decoded.username)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// DELETE - Bulk delete new converts and all related data
export async function DELETE(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized - Only skaduteye and sysadmin can perform bulk delete' }, { status: 401 });
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

    // Get the converts before deleting for response
    const convertsToDelete = await prisma.newConvert.findMany({
      where: { id: { in: person_ids } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    // Delete will cascade due to onDelete: Cascade in schema
    await prisma.newConvert.deleteMany({
      where: { id: { in: person_ids } },
    });

    return NextResponse.json({
      success: true,
      deleted_count: convertsToDelete.length,
      deleted_records: convertsToDelete.map((c: { id: string; firstName: string | null; lastName: string | null }) => ({
        id: c.id,
        full_name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      })),
      message: `Successfully deleted ${convertsToDelete.length} convert(s) and all related data`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error deleting converts:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
