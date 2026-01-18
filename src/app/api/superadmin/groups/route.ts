import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

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

// Helper function to get month order for sorting
function getMonthOrder(name: string): number {
  const monthMap: Record<string, number> = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12
  };
  return monthMap[name.toLowerCase()] || 999;
}

// GET - List all groups with optional archived filtering
export async function GET(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'active';

    // Build where clause
    const where: Prisma.GroupWhereInput = {};
    if (filter === 'active') {
      where.archived = false;
    } else if (filter === 'archived') {
      where.archived = true;
    }

    const groups = await prisma.group.findMany({
      where,
      include: {
        leader: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        },
        _count: {
          select: { newConverts: true }
        }
      }
    });

    // Transform and sort by month order
    const transformedGroups = groups.map(g => {
      let leaderName = 'No Leader';
      if (g.leader) {
        if (g.leader.firstName && g.leader.lastName) {
          leaderName = `${g.leader.firstName} ${g.leader.lastName}`;
        } else if (g.leader.firstName) {
          leaderName = g.leader.firstName;
        } else {
          leaderName = g.leader.username || g.leader.email || 'No Leader';
        }
      }

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        year: g.year,
        archived: g.archived,
        leader_id: g.leaderId,
        leader_name: leaderName,
        created_at: g.createdAt,
        updated_at: g.updatedAt,
        member_count: g._count.newConverts,
        month_order: getMonthOrder(g.name),
      };
    });

    // Sort by month order then by name
    transformedGroups.sort((a, b) => {
      if (a.month_order !== b.month_order) {
        return a.month_order - b.month_order;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ groups: transformedGroups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new group
export async function POST(request: NextRequest) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, year, leader_id } = body;

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        year: year || null,
        archived: false,
        leaderId: leader_id || null,
      }
    });

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        year: group.year,
        archived: group.archived,
        leader_id: group.leaderId,
        created_at: group.createdAt,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating group:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
