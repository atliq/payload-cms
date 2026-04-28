import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

// Fix doubled file extensions like .jpg.jpg, .png.png, .webp.webp, .jpeg.jpeg
const DOUBLE_EXT_REGEX = /(\.[a-zA-Z]{2,5})\1(?=[?&"'\s,]|$)/g

function hasDoubleExtensions(html: string): boolean {
  DOUBLE_EXT_REGEX.lastIndex = 0
  return DOUBLE_EXT_REGEX.test(html)
}

function fixDoubleExtensions(html: string): string {
  return html.replace(/(\.[a-zA-Z]{2,5})\1(?=[?&"'\s,]|$)/g, '$1')
}

async function processCollection(
  payload: any,
  collection: 'posts' | 'culture-posts',
): Promise<{ fixed: number; failed: number }> {
  let fixed = 0
  let failed = 0

  const all = await payload.find({ collection, limit: 2000, depth: 0 })
  const needsFix = all.docs.filter((doc: any) => hasDoubleExtensions(doc.legacyContent || ''))

  console.log(`  ${needsFix.length} of ${all.docs.length} records have doubled file extensions`)

  for (const doc of needsFix) {
    try {
      const newHtml = fixDoubleExtensions(doc.legacyContent)
      await payload.update({ collection, id: doc.id, data: { legacyContent: newHtml } })
      fixed++
      console.log(`  [fix] ${doc.title?.substring(0, 70)}`)
    } catch (err) {
      failed++
      console.error(`  [fail] ID ${doc.id}:`, (err as Error).message)
    }
  }

  return { fixed, failed }
}

async function main() {
  console.log('=== Fix Doubled File Extensions in legacyContent ===\n')

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
    console.log(`${totalFailed} record(s) failed.`)
    process.exit(1)
  }
  console.log('All doubled file extensions fixed!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
