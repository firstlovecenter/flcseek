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

// GET - Get single convert by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    
    const convert = await prisma.newConvert.findUnique({
      where: { id },
      include: {
        registeredBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!convert) {
      return NextResponse.json({ error: 'Convert not found' }, { status: 404 });
    }

    return NextResponse.json({
      convert: {
        id: convert.id,
        first_name: convert.firstName,
        last_name: convert.lastName,
        full_name: `${convert.firstName} ${convert.lastName}`.trim(),
        phone_number: convert.phoneNumber,
        date_of_birth: convert.dateOfBirth,
        gender: convert.gender,
        residential_location: convert.residentialLocation,
        school_residential_location: convert.schoolResidentialLocation,
        occupation_type: convert.occupationType,
        group_id: convert.groupId,
        group_name: convert.groupName,
        registered_by: convert.registeredBy ? `${convert.registeredBy.firstName} ${convert.registeredBy.lastName}`.trim() : null,
        created_at: convert.createdAt,
        updated_at: convert.updatedAt,
      }
    });
  } catch (error) {
    console.error('Error fetching convert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update convert details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = verifyAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      first_name,
      last_name,
      phone_number,
      date_of_birth,
      gender,
      residential_location,
      school_residential_location,
      occupation_type,
      group_name,
    } = body;

    const convert = await prisma.newConvert.update({
      where: { id },
      data: {
        firstName: first_name,
        lastName: last_name,
        phoneNumber: phone_number,
        dateOfBirth: date_of_birth || null,
        gender: gender || null,
        residentialLocation: residential_location || null,
        schoolResidentialLocation: school_residential_location || null,
        occupationType: occupation_type || null,
        groupName: group_name,
      }
    });

    return NextResponse.json({
      success: true,
      convert: {
        id: convert.id,
        first_name: convert.firstName,
        last_name: convert.lastName,
        full_name: `${convert.firstName} ${convert.lastName}`.trim(),
        phone_number: convert.phoneNumber,
        date_of_birth: convert.dateOfBirth,
        gender: convert.gender,
        residential_location: convert.residentialLocation,
        school_residential_location: convert.schoolResidentialLocation,
        occupation_type: convert.occupationType,
        group_name: convert.groupName,
        updated_at: convert.updatedAt,
      },
      message: 'Convert updated successfully',
    });
  } catch (error) {
    console.error('Error updating convert:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Convert not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a single convert and all related data
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
    
    // First, get the convert's name for the response message
    const convert = await prisma.newConvert.findUnique({
      where: { id },
      select: {
        firstName: true,
        lastName: true,
        phoneNumber: true,
      }
    });

    if (!convert) {
      return NextResponse.json({ error: 'Convert not found' }, { status: 404 });
    }

    const convertName = `${convert.firstName} ${convert.lastName}`.trim();

    // Delete the convert (CASCADE will automatically delete progress_records and attendance_records)
    await prisma.newConvert.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${convertName} and all related data`,
      deletedConvert: {
        name: convertName,
        phone: convert.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Error deleting convert:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Convert not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
