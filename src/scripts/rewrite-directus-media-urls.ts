import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fetchFileInfo } from './migration/directus-client'

const DIRECTUS_URL = 'https://wp-api.atliq.com'
const PAYLOAD_CMS_URL = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://payload-cms.atliq.com'

// Matches https://wp-api.atliq.com/assets/UUID with optional query/fragment
const DIRECTUS_ASSET_REGEX = /https?:\/\/wp-api\.atliq\.com\/assets\/([a-f0-9-]{36})([?#][^\s"'<>]*)?/gi

function collectDirectusUuids(html: string): Set<string> {
  const uuids = new Set<string>()
  const regex = new RegExp(DIRECTUS_ASSET_REGEX.source, 'gi')
  let match
  while ((match = regex.exec(html)) !== null) {
    uuids.add(match[1])
  }
  return uuids
}

function rewriteUrls(html: string, uuidToUrl: Map<string, string>): string {
  return html.replace(
    new RegExp(DIRECTUS_ASSET_REGEX.source, 'gi'),
    (_, uuid) => uuidToUrl.get(uuid) || `${DIRECTUS_URL}/assets/${uuid}`,
  )
}

async function buildUuidToUrlMap(uuids: Set<string>): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let i = 0
  for (const uuid of uuids) {
    i++
    try {
      const fileInfo = await fetchFileInfo(uuid)
      const filename = fileInfo?.filename_download || `${uuid}.jpg`
      map.set(uuid, `${PAYLOAD_CMS_URL}/api/media/file/${encodeURIComponent(filename)}`)
      if (i % 50 === 0) console.log(`  Resolved ${i}/${uuids.size} media UUIDs...`)
      // Small delay to avoid hammering Directus
      await new Promise((r) => setTimeout(r, 80))
    } catch (err) {
      console.warn(`  [warn] Could not resolve UUID ${uuid}:`, (err as Error).message)
    }
  }
  return map
}

async function main() {
  console.log('=== Rewrite Directus Media URLs in legacyContent ===')
  console.log(`Replacing with base URL: ${PAYLOAD_CMS_URL}\n`)

  console.log('Initializing Payload...')
  const payload = await getPayload({ config })
  console.log('Payload initialized.\n')

  // Fetch all posts and culture-posts from Payload
  console.log('Fetching posts from Payload...')
  const [postsData, culturePostsData] = await Promise.all([
    payload.find({ collection: 'posts', limit: 2000, depth: 0 }),
    payload.find({ collection: 'culture-posts', limit: 2000, depth: 0 }),
  ])
  console.log(
    `Found ${postsData.docs.length} posts, ${culturePostsData.docs.length} culture posts\n`,
  )

  // Collect all unique Directus UUIDs across all legacyContent
  const allUuids = new Set<string>()
  const postsNeedingUpdate: Array<{ id: number; legacyContent: string }> = []
  const culturePostsNeedingUpdate: Array<{ id: number; legacyContent: string }> = []

  for (const post of postsData.docs) {
    const html = (post as any).legacyContent || ''
    if (!html) continue
    const uuids = collectDirectusUuids(html)
    if (uuids.size > 0) {
      postsNeedingUpdate.push({ id: post.id as number, legacyContent: html })
      uuids.forEach((u) => allUuids.add(u))
    }
  }

  for (const post of culturePostsData.docs) {
    const html = (post as any).legacyContent || ''
    if (!html) continue
    const uuids = collectDirectusUuids(html)
    if (uuids.size > 0) {
      culturePostsNeedingUpdate.push({ id: post.id as number, legacyContent: html })
      uuids.forEach((u) => allUuids.add(u))
    }
  }

  console.log(`Posts needing URL rewrite: ${postsNeedingUpdate.length}`)
  console.log(`Culture posts needing URL rewrite: ${culturePostsNeedingUpdate.length}`)
  console.log(`Unique Directus media UUIDs: ${allUuids.size}\n`)

  if (allUuids.size === 0) {
    console.log('No Directus URLs found in legacyContent. Nothing to do.')
    process.exit(0)
  }

  // Resolve all UUIDs to Payload media URLs
  console.log(`--- Resolving ${allUuids.size} media filenames from Directus ---`)
  const uuidToUrl = await buildUuidToUrlMap(allUuids)
  console.log(`Resolved ${uuidToUrl.size} of ${allUuids.size} UUIDs\n`)

  // Update posts
  let succeeded = 0
  let failed = 0

  console.log('--- Updating Posts ---')
  for (const { id, legacyContent } of postsNeedingUpdate) {
    try {
      const newHtml = rewriteUrls(legacyContent, uuidToUrl)
      await payload.update({ collection: 'posts', id, data: { legacyContent: newHtml } })
      succeeded++
      if (succeeded % 10 === 0) console.log(`  Updated ${succeeded} posts...`)
    } catch (err) {
      failed++
      console.error(`  [fail] Post ID ${id}:`, (err as Error).message)
    }
  }
  console.log(`Posts: ${succeeded} updated, ${failed} failed\n`)

  const cultureSucceeded = { count: 0 }
  const cultureFailed = { count: 0 }

  console.log('--- Updating Culture Posts ---')
  for (const { id, legacyContent } of culturePostsNeedingUpdate) {
    try {
      const newHtml = rewriteUrls(legacyContent, uuidToUrl)
      await payload.update({ collection: 'culture-posts', id, data: { legacyContent: newHtml } })
      cultureSucceeded.count++
    } catch (err) {
      cultureFailed.count++
      console.error(`  [fail] Culture post ID ${id}:`, (err as Error).message)
    }
  }
  console.log(`Culture Posts: ${cultureSucceeded.count} updated, ${cultureFailed.count} failed\n`)

  const totalFailed = failed + cultureFailed.count
  console.log('=== Done ===')
  if (totalFailed > 0) {
    console.log(`⚠ ${totalFailed} record(s) failed.`)
    process.exit(1)
  }
  console.log('URL rewrite complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
