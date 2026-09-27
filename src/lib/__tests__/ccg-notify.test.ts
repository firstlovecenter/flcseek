import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLeaderSms, gsmSafe, SMS_SEGMENT, smsKey } from '@/lib/ccg/server/notify'
import { sendSms, smsConfigured } from '@/lib/ccg/server/sms'

const GSM_ONLY = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/

describe('CCF Coordinator SMS', () => {
  it('greets by first name only and counts the new souls', () => {
    expect(buildLeaderSms({ firstName: 'Ama Serwaa', count: 1, ccfNames: ['Music Family'], event: 'placed' })).toBe(
      'Hi Ama, you have 1 new soul in Music Family. Please log in to the CCG app to see and welcome them.'
    )
    expect(buildLeaderSms({ firstName: 'Kofi', count: 3, ccfNames: ['Music Family'], event: 'placed' })).toBe(
      'Hi Kofi, you have 3 new souls in Music Family. Please log in to the CCG app to see and welcome them.'
    )
    expect(buildLeaderSms({ firstName: null, count: 2, ccfNames: ['A', 'B'], event: 'placed' })).toBe(
      'Hi, you have 2 new souls in your CCFs. Please log in to the CCG app to see and welcome them.'
    )
    expect(buildLeaderSms({ firstName: 'Kofi', count: 1, ccfNames: ['Music Family'], event: 'transferred' })).toBe(
      'Hi Kofi, 1 soul has been transferred to Music Family. Please log in to the CCG app to see them.'
    )
  })

  it('always fits one GSM segment, shortening only the CCF name', () => {
    const cases = [
      { firstName: 'Nana', ccfNames: ['The Very Long Named City Church Family Of The Greater Accra Region Football And Music Lovers'] },
      { firstName: 'Bartholomew-Kwabenaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ccfNames: ['Online with Bishop Isaac Agyemang and Friends'] },
      { firstName: 'Ëmmánuel', ccfNames: ['Jesus’ “Loved” Ones — Weekday [Group] €'] },
    ]
    for (const c of cases) {
      for (const event of ['placed', 'transferred'] as const) {
        const text = buildLeaderSms({ ...c, count: 12, event })
        expect(text.length).toBeLessThanOrEqual(SMS_SEGMENT)
        expect(text).toMatch(GSM_ONLY)
      }
    }
    const long = buildLeaderSms({ firstName: 'Nana', count: 2, ccfNames: [cases[0].ccfNames[0]], event: 'placed' })
    expect(long.startsWith('Hi Nana, you have 2 new souls in The Very Long')).toBe(true)
  })

  it('keeps names readable in the GSM set', () => {
    expect(gsmSafe('Ëmmánuel’s “CCF” — [A]')).toBe('Emmanuel\'s "CCF" - (A)')
    expect(gsmSafe('Adéla')).toBe('Adéla')
  })

  it('uses the same idempotency key for the same batch', () => {
    expect(smsKey('placed', '233241234567', ['b', 'a'])).toBe(smsKey('placed', '233241234567', ['a', 'b']))
    expect(smsKey('placed', '233241234567', ['a'])).not.toBe(smsKey('transferred', '233241234567', ['a']))
  })
})

describe('FlashSMS client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  const configure = () => {
    vi.stubEnv('VITEST', '')
    vi.stubEnv('FLASHSMS_API_KEY', 'bms_live_test')
    vi.stubEnv('FLASHSMS_BASE_URL', 'https://api.flashsms.africa/api/v2/')
    vi.stubEnv('FLASHSMS_SENDER_ID', 'FLCSeek')
  }

  it('never sends under tests', () => {
    expect(smsConfigured()).toBe(false)
  })

  it('posts to /sms/send with the key, sender and idempotency key', async () => {
    configure()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'msg_1', status: 'PENDING' } }), { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendSms({ phones: ['233241234567'], message: 'Hi', idempotencyKey: 'k1' })).resolves.toEqual({ sent: true, id: 'msg_1' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.flashsms.africa/api/v2/sms/send')
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k1')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer bms_live_test')
    expect(JSON.parse(init.body as string)).toEqual({ message: 'Hi', phones: ['233241234567'], senderId: 'FLCSeek' })
  })

  it('reports provider errors and network failures without throwing', async () => {
    configure()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'INSUFFICIENT_CREDITS', message: 'Insufficient credits' } }), { status: 402 })))
    await expect(sendSms({ phones: ['1'], message: 'Hi', idempotencyKey: 'k' })).resolves.toEqual({ sent: false, reason: 'Insufficient credits' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(sendSms({ phones: ['1'], message: 'Hi', idempotencyKey: 'k' })).resolves.toEqual({ sent: false, reason: 'Could not reach the SMS provider' })
  })
})
