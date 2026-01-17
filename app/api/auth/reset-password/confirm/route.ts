import { NextResponse } from 'next/server';

/**
 * Endpoint disabled.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Password reset has been disabled.' },
    { status: 404 }
  );
}
