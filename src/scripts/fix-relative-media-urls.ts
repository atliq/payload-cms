import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

const PAYLOAD_CMS_URL = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://payload-cms.atliq.com'

// Matches any standalone relative /api/media/file/... URL (not already preceded by http)
const RELATIVE_URL_REGEX = /(?<!['"=])\/api\/media\/file\/[^\s"',]+/g
// Quick check: any relative media URL at all
const HAS_RELATIVE_REGEX = /(?<![a-z])\/api\/media\/file\//

function hasRelativeMediaUrls(html: string): boolean {
  return HAS_RELATIVE_REGEX.test(html)
}

function fixRelativeUrls(html: string): string {
  // Fix all occurrences of /api/media/file/... that are not already preceded by a protocol
  return html.replace(
    /(["',\s])\/api\/media\/file\//g,
    (_, prefix) => `${prefix}${PAYLOAD_CMS_URL}/api/media/file/`,
  )
}

async function processCollection(
  payload: any,
  collection: 'posts' | 'culture-posts',
): Promise<{ fixed: number; failed: number }> {
  let fixed = 0
  let failed = 0

  const all = await payload.find({ collection, limit: 2000, depth: 0 })
  const needsFix = all.docs.filter((doc: any) => hasRelativeMediaUrls(doc.legacyContent || ''))

  console.log(`  ${needsFix.length} of ${all.docs.length} records have relative media URLs`)

  for (const doc of needsFix) {
    try {
      const newHtml = fixRelativeUrls(doc.legacyContent)
      await payload.update({ collection, id: doc.id, data: { legacyContent: newHtml } })
      fixed++
      console.log(`  [fix] ${doc.title?.substring(0, 60)}`)
    } catch (err) {
      failed++
      console.error(`  [fail] ID ${doc.id}:`, (err as Error).message)
    }
  }

  return { fixed, failed }
}

async function main() {
  console.log('=== Fix Relative Media URLs in legacyContent ===')
  console.log(`Replacing relative URLs with base: ${PAYLOAD_CMS_URL}\n`)

  const payload = await getPayload({ config })

  console.log('--- Posts ---')
  const postsResult = await processCollection(payload, 'posts')
  console.log(`Posts: ${postsResult.fixed} fixed, ${postsResult.failed} failed\n`)

  console.log('--- Culture Posts ---')
  const cultureResult = await processCollection(payload, 'culture-posts')
  console.log(`Culture Posts: ${cultureResult.fixed} fixed, ${cultureResult.failed} failed\n`)

  const totalFailed = postsResult.failed + cultureResult.failed
  console.log('=== Done ===')
  if (totalFailed > 0) {
    console.log(`⚠ ${totalFailed} record(s) failed.`)
    process.exit(1)
  }
  console.log('All relative media URLs fixed!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
