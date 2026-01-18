/**
 * Example API route showing Prisma usage with Next.js 15
 * 
 * This demonstrates how to use the Prisma ORM in your API routes.
 * Replace with your actual implementation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/example
 * Fetch all users with their groups
 */
export async function GET(request: NextRequest) {
  try {
    // Example: Fetch all users
    const users = await prisma.user.findMany({
      include: {
        groups: true,
        leaderGroups: true,
      },
      where: {
        deletedAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      count: users.length,
      data: users,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/example
 * Example: Create a new group
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, year, description } = body

    // Create a new group
    const group = await prisma.group.create({
      data: {
        name,
        year: year || new Date().getFullYear(),
        description,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: group,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create group',
      },
      { status: 500 }
    )
  }
}
