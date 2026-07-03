import crypto from 'crypto'
import type { CollectionAfterChangeHook } from 'payload'
import type { Inquiry } from '@/payload-types'

// Forwards new inquiries to Kaizen, signed with HMAC-SHA256 so Kaizen can
// verify the request came from this server. The endpoint URL (which embeds
// the intake token) and the signing secret both stay server-side; the
// visitor's browser never sees them.
export const forwardInquiryToKaizen: CollectionAfterChangeHook<Inquiry> = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const secret = process.env.KAIZEN_INQUIRY_SECRET
  const url = process.env.KAIZEN_INQUIRY_URL
  if (!secret || !url) {
    req.payload.logger.warn(
      '[Kaizen] KAIZEN_INQUIRY_URL / KAIZEN_INQUIRY_SECRET not set — inquiry not forwarded',
    )
    return doc
  }

  const body = JSON.stringify({
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? null,
    message: doc.message,
    source: 'atliq-website-contact-form',
    // Anything beyond Kaizen's core schema lands in inquiry.custom_fields:
    company: doc.company ?? null,
    website: doc.website ?? null,
    subject: doc.subject ?? null,
    sourceIp: doc.sourceIp ?? null,
  })

  const t = Math.floor(Date.now() / 1000)
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Inquiry-Signature': `t=${t},v1=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status !== 201) {
      req.payload.logger.error(
        `[Kaizen] inquiry forward failed: ${res.status} ${await res.text()}`,
      )
    }
  } catch (err) {
    // Don't block the submission if Kaizen is down — the inquiry is still
    // saved in Payload and can be resent manually if needed.
    req.payload.logger.error(`[Kaizen] inquiry forward error: ${String(err)}`)
  }

  return doc
}
