import { NextRequest, NextResponse } from 'next/server'
import { sendSms, smsConfigured } from '@/lib/ccg/server/sms'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phone = req.nextUrl.searchParams.get('phone') ?? '0557382057'
  if (!smsConfigured()) {
    return NextResponse.json({ success: false, error: 'FLC_NOTIFY not configured' }, { status: 500 })
  }

  const result = await sendSms({
    phones: [phone],
    message: `Test SMS from flcseek via FLC Notify. Time: ${new Date().toISOString()}`,
    idempotencyKey: `test-${Date.now()}`,
  })

  return NextResponse.json({ ...result, phone })
}
