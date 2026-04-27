import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fetchPosts, fetchCulturePosts } from './migration/directus-client'
import { createIdMaps } from './migration/id-map'
import { collectMediaUuids, migrateMedia } from './migration/media-migrator'
import { htmlToLexical } from './migration/html-to-lexical'

const IMG_TAG_REGEX = /<img[^>]+>/i

function hasImages(html: string): boolean {
  return IMG_TAG_REGEX.test(html)
}

function stripSlugPrefix(slug: string): string {
  if (!slug) return slug
  return slug
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^\/+/, '')
}

async function updateCollection(
  payload: any,
  collection: 'posts' | 'culture-posts',
  directusPosts: any[],
  idMaps: ReturnType<typeof createIdMaps>,
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const post of directusPosts) {
    try {
      const slug = stripSlugPrefix(post.slug)
      const existing = await payload.find({
        collection,
        where: { slug: { equals: slug } },
        limit: 1,
      })

      if (existing.docs.length === 0) {
        console.log(`  [skip] Not found in Payload: ${post.title}`)
        skipped++
        continue
      }

      const newContent = htmlToLexical(post.content || '', idMaps)

      await payload.update({
        collection,
        id: existing.docs[0].id,
        data: { content: newContent },
      })

      succeeded++
      console.log(`  [ok] ${post.title}`)
    } catch (error) {
      failed++
      console.error(`  [fail] "${post.title}":`, (error as Error).message)
    }
  }

  return { succeeded, failed, skipped }
}

async function main() {
  console.log('=== Migrate Content Images ===\n')

  console.log('Initializing Payload...')
  const payload = await getPayload({ config })
  console.log('Payload initialized.\n')

  const idMaps = createIdMaps()

  console.log('Fetching posts from Directus...')
  const [posts, culturePosts] = await Promise.all([fetchPosts(), fetchCulturePosts()])
  console.log(`Fetched ${posts.length} posts, ${culturePosts.length} culture posts\n`)

  const postsWithImages = posts.filter((p) => hasImages(p.content || ''))
  const culturePostsWithImages = culturePosts.filter((p) => hasImages(p.content || ''))
  console.log(`Posts with inline images: ${postsWithImages.length}`)
  console.log(`Culture posts with inline images: ${culturePostsWithImages.length}\n`)

  if (postsWithImages.length === 0 && culturePostsWithImages.length === 0) {
    console.log('No posts with inline images. Nothing to do.')
    process.exit(0)
  }

  // Collect and migrate all media UUIDs found in content
  console.log('--- Collecting image media UUIDs ---')
  const mediaUuids = await collectMediaUuids([], [], postsWithImages, culturePostsWithImages)
  console.log(`Found ${mediaUuids.size} unique image assets\n`)

  if (mediaUuids.size > 0) {
    console.log('--- Migrating Image Media ---')
    const mediaResult = await migrateMedia(payload, mediaUuids, idMaps)
    console.log(
      `Media: ${mediaResult.succeeded} migrated, ${mediaResult.failed} failed, ${mediaResult.skipped} skipped\n`,
    )
  }

  // Re-convert and update post content with image nodes
  console.log('--- Updating Posts ---')
  const postsResult = await updateCollection(payload, 'posts', postsWithImages, idMaps)
  console.log(
    `Posts: ${postsResult.succeeded} updated, ${postsResult.failed} failed, ${postsResult.skipped} skipped\n`,
  )

  console.log('--- Updating Culture Posts ---')
  const cultureResult = await updateCollection(
    payload,
    'culture-posts',
    culturePostsWithImages,
    idMaps,
  )
  console.log(
    `Culture Posts: ${cultureResult.succeeded} updated, ${cultureResult.failed} failed, ${cultureResult.skipped} skipped\n`,
  )

  const totalFailed = postsResult.failed + cultureResult.failed
  console.log('=== Done ===')
  if (totalFailed > 0) {
    console.log(`⚠ ${totalFailed} record(s) failed. Review errors above.`)
    process.exit(1)
  }
  console.log('Content image migration complete!')
  process.exit(0)
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
