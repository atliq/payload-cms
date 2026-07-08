/* Temporary seed script for verifying the inquiries export feature. Delete after use. */
import { getPayload } from 'payload'
import config from './src/payload.config'

const run = async () => {
  const payload = await getPayload({ config: await config })

  const email = 'export-test@atliq.com'
  const password = 'ExportTest1234!'
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (existing.docs.length === 0) {
    await payload.create({ collection: 'users', data: { email, password } })
    console.log(`created user ${email}`)
  } else {
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: { password },
    })
    console.log(`reset password for ${email}`)
  }

  const seedInquiries = [
    { name: 'Range Test May', email: 'may@test.com', message: 'seeded may', createdAt: '2026-05-10T10:00:00.000Z' },
    { name: 'Range Test June', email: 'june@test.com', message: 'seeded june', createdAt: '2026-06-15T10:00:00.000Z' },
    { name: 'Range Test July', email: 'july@test.com', message: 'seeded july', createdAt: '2026-07-05T10:00:00.000Z' },
  ]
  for (const data of seedInquiries) {
    const dupe = await payload.find({
      collection: 'inquiries',
      where: { name: { equals: data.name } },
      limit: 1,
    })
    if (dupe.docs.length === 0) {
      const doc = await payload.create({
        collection: 'inquiries',
        data: { ...data, status: 'new' },
      })
      console.log(`created inquiry ${data.name} createdAt=${doc.createdAt}`)
    } else {
      console.log(`inquiry ${data.name} already present createdAt=${dupe.docs[0].createdAt}`)
    }
  }

  const total = await payload.count({ collection: 'inquiries' })
  console.log(`total inquiries: ${total.totalDocs}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
