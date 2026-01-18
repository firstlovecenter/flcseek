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
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };
    if (decoded.role !== 'superadmin') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// PUT - Update group
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, year, archived, leader_id } = body;
    const { id } = await params;

    // Build dynamic update data based on provided fields
    const data: Record<string, any> = {};

    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (year !== undefined) data.year = year;
    if (archived !== undefined) data.archived = archived;
    if (leader_id !== undefined) {
      data.leader = leader_id ? { connect: { id: leader_id } } : { disconnect: true };
    }

    const group = await prisma.group.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        year: group.year,
        archived: group.archived,
        leader_id: group.leaderId,
        updated_at: group.updatedAt,
      }
    });
  } catch (error) {
    console.error('Error updating group:', error);
    const errorCode = (error as any)?.code;
    if (errorCode === 'P2025') {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    if (errorCode === 'P2002') {
      return NextResponse.json({ error: 'Group name and year combination already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    
    await prisma.group.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting group:', error);
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
