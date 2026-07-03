// @vitest-environment node
import crypto from 'crypto'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, beforeEach, afterEach, expect, vi } from 'vitest'

const TEST_SECRET = 'test-signing-secret'
const TEST_URL = 'https://kaizen.example.test/api/inquiries/test-token'

let payload: Payload
const createdIds: (number | string)[] = []

const createInquiry = () =>
  payload.create({
    collection: 'inquiries',
    data: {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+91 99999 99999',
      company: 'AtliQ',
      subject: 'Integration test',
      message: 'Hello from the Kaizen forwarding test',
      status: 'new',
    },
  })

describe('Kaizen inquiry forwarding', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  }, 60_000)

  beforeEach(() => {
    vi.stubEnv('KAIZEN_INQUIRY_SECRET', TEST_SECRET)
    vi.stubEnv('KAIZEN_INQUIRY_URL', TEST_URL)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    for (const id of createdIds.splice(0)) {
      await payload.delete({ collection: 'inquiries', id })
    }
  })

  it('forwards new inquiries with a valid HMAC signature', async () => {
    const fetchMock = vi.fn(async () => ({ status: 201, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)

    const doc = await createInquiry()
    createdIds.push(doc.id)

    // Payload also pings its telemetry endpoint via fetch — only count Kaizen calls.
    const kaizenCalls = fetchMock.mock.calls.filter(([url]) => String(url) === TEST_URL)
    expect(kaizenCalls).toHaveLength(1)
    const [, init] = kaizenCalls[0] as unknown as [string, RequestInit]

    expect(init.method).toBe('POST')

    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')

    const signature = headers['X-Inquiry-Signature']
    const match = signature.match(/^t=(\d+),v1=([0-9a-f]{64})$/)
    expect(match).not.toBeNull()

    const [, t, v1] = match!
    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${t}.${init.body as string}`)
      .digest('hex')
    expect(v1).toBe(expected)

    expect(JSON.parse(init.body as string)).toMatchObject({
      name: 'Test User',
      email: 'test@example.com',
      phone: '+91 99999 99999',
      message: 'Hello from the Kaizen forwarding test',
      source: 'atliq-website-contact-form',
      company: 'AtliQ',
      subject: 'Integration test',
    })
  })

  it('still saves the inquiry when the forward request rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network down'))))

    const doc = await createInquiry()
    createdIds.push(doc.id)
    expect(doc.id).toBeDefined()
  })

  it('still saves the inquiry when Kaizen responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 500, text: async () => 'boom' })))

    const doc = await createInquiry()
    createdIds.push(doc.id)
    expect(doc.id).toBeDefined()
  })

  it('skips forwarding when KAIZEN_INQUIRY_SECRET is not set', async () => {
    vi.stubEnv('KAIZEN_INQUIRY_SECRET', undefined)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const doc = await createInquiry()
    createdIds.push(doc.id)

    expect(doc.id).toBeDefined()
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === TEST_URL)).toHaveLength(0)
  })

  it('skips forwarding when KAIZEN_INQUIRY_URL is not set', async () => {
    vi.stubEnv('KAIZEN_INQUIRY_URL', undefined)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const doc = await createInquiry()
    createdIds.push(doc.id)

    expect(doc.id).toBeDefined()
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === TEST_URL)).toHaveLength(0)
  })

  it('does not forward on update', async () => {
    const fetchMock = vi.fn(async () => ({ status: 201, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)

    const doc = await createInquiry()
    createdIds.push(doc.id)
    fetchMock.mockClear()

    await payload.update({
      collection: 'inquiries',
      id: doc.id,
      data: { status: 'reviewed' },
    })

    expect(fetchMock.mock.calls.filter(([url]) => String(url) === TEST_URL)).toHaveLength(0)
  })
})
