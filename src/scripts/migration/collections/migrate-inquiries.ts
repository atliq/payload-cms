import type { BasePayload } from 'payload'

export async function migrateInquiries(
  payload: BasePayload,
  inquiries: any[],
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const inquiry of inquiries) {
    try {
      // Check for duplicates by email + name combination
      const existing = await payload.find({
        collection: 'inquiries',
        where: {
          and: [
            { email: { equals: inquiry.email } },
            { name: { equals: inquiry.name } },
          ],
        },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        skipped++
        console.log(`  [skip] Inquiry exists: ${inquiry.name} <${inquiry.email}>`)
        continue
      }

      await payload.create({
        collection: 'inquiries',
        data: {
          name: inquiry.name || '',
          email: inquiry.email || '',
          phone: inquiry.phone || '',
          company: inquiry.company || '',
          website: inquiry.website || '',
          subject: inquiry.subject || '',
          message: inquiry.message || '',
          sourceIp: inquiry.sourceIp || '',
          status: 'new',
        },
      })

      succeeded++
      console.log(`  [ok] Inquiry: ${inquiry.name} <${inquiry.email}>`)
    } catch (error) {
      failed++
      console.error(`  [fail] Inquiry ${inquiry.name}:`, (error as Error).message)
    }
  }

  return { succeeded, failed, skipped }
}
