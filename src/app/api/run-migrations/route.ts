import { NextResponse } from 'next/server';

/**
 * This endpoint has been disabled for security reasons.
 * Run migrations via CLI: npx prisma migrate deploy
 */
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been disabled. Run migrations via CLI: npx prisma migrate deploy' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint has been disabled.' },
    { status: 410 }
  );
}
