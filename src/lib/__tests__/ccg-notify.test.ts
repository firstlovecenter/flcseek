import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLeaderSms, gsmSafe, SMS_SEGMENT, smsKey } from '@/lib/ccg/server/notify'
import { sendSms, smsConfigured } from '@/lib/ccg/server/sms'

const GSM_ONLY = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/

describe('CCF Coordinator SMS', () => {
  it('greets by first name only, with nothing else personal', () => {
    const text = 'you have new souls in your CCF. Please log in to the CCG app to see and welcome them: https://seek.codeslaw.dev/auth'
    expect(buildLeaderSms({ firstName: 'Ama Serwaa' })).toBe(`Hi Ama, ${text}`)
    expect(buildLeaderSms({ firstName: null })).toBe(`Hi, ${text}`)
    expect(buildLeaderSms({ firstName: '  ' })).toBe(`Hi, ${text}`)
  })

  it('always fits one GSM segment', () => {
    for (const firstName of ['Ëmmánuel', 'Jesus’', 'Bartholomew-Kwabenaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']) {
      const text = buildLeaderSms({ firstName })
      expect(text.length).toBeLessThanOrEqual(SMS_SEGMENT)
      expect(text).toMatch(GSM_ONLY)
      expect(text).toMatch(/ https:\/\/seek\.codeslaw\.dev\/auth$/)
    }
    expect(buildLeaderSms({ firstName: 'Ëmmánuel' })).toMatch(/^Hi Emmanuel, /)
  })

  it('keeps names readable in the GSM set', () => {
    expect(gsmSafe('Ëmmánuel’s "CCF" — [A]')).toBe('Emmanuel\'s "CCF" - (A)')
    expect(gsmSafe('Adéla')).toBe('Adéla')
  })

  it('uses the same idempotency key for the same batch', () => {
    expect(smsKey('placed', '233241234567', ['b', 'a'])).toBe(smsKey('placed', '233241234567', ['a', 'b']))
    expect(smsKey('placed', '233241234567', ['a'])).not.toBe(smsKey('transferred', '233241234567', ['a']))
  })
})

describe('FLC Notify SMS client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  const configure = () => {
    vi.stubEnv('VITEST', '')
    vi.stubEnv('FLC_NOTIFY_KEY', 'test_key')
    vi.stubEnv('FLC_NOTIFY_URL', 'https://notify.example.com')
    vi.stubEnv('FLC_NOTIFY_SENDER_ID', 'FLCSeek')
  }

  it('never sends under tests', () => {
    expect(smsConfigured()).toBe(false)
  })

  it('posts to /send-sms with the key and sender', async () => {
    configure()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { id: 'msg_1', status: 'PENDING' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendSms({ phones: ['233241234567'], message: 'Hi', idempotencyKey: 'k1' })).resolves.toEqual({ sent: true, id: 'msg_1' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://notify.example.com/send-sms')
    expect((init.headers as Record<string, string>)['x-secret-key']).toBe('test_key')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(JSON.parse(init.body as string)).toEqual({ recipient: ['233241234567'], message: 'Hi', sender: 'FLCSeek' })
  })

  it('reports provider errors and network failures without throwing', async () => {
    configure()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'Insufficient credits', message: 'Insufficient credits' }), { status: 400 })))
    await expect(sendSms({ phones: ['1'], message: 'Hi', idempotencyKey: 'k' })).resolves.toEqual({ sent: false, reason: 'Insufficient credits' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(sendSms({ phones: ['1'], message: 'Hi', idempotencyKey: 'k' })).resolves.toEqual({ sent: false, reason: 'Could not reach the SMS provider' })
  })
})
