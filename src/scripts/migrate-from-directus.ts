import 'dotenv/config'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// MUST be first before importing anything else!
initOpenNextCloudflareForDev()

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  fetchAuthors,
  fetchCategories,
  fetchPosts,
  fetchCulturePosts,
  fetchInquiries,
  fetchSeoRecords,
} from './migration/directus-client'
import { createIdMaps } from './migration/id-map'
import { collectMediaUuids, migrateMedia } from './migration/media-migrator'
import { migrateCategories } from './migration/collections/migrate-categories'
import { migrateAuthors } from './migration/collections/migrate-authors'
import { migratePosts } from './migration/collections/migrate-posts'
import { migrateCulturePosts } from './migration/collections/migrate-culture-posts'
import { migrateInquiries } from './migration/collections/migrate-inquiries'

async function main() {
  console.log('=== Directus to Payload CMS Migration ===\n')

  // Initialize Payload
  console.log('Initializing Payload...')
  const payload = await getPayload({ config })
  console.log('Payload initialized.\n')

  const idMaps = createIdMaps()
  const results: Record<string, { succeeded: number; failed: number; skipped: number }> = {}

  // Step 1: Fetch all data from Directus
  console.log('Fetching data from Directus...')
  const [authors, categories, posts, culturePosts, inquiries, seoRecords] = await Promise.all([
    fetchAuthors(),
    fetchCategories(),
    fetchPosts(),
    fetchCulturePosts(),
    fetchInquiries(),
    fetchSeoRecords(),
  ])
  console.log(
    `Fetched: ${authors.length} authors, ${categories.length} categories, ${posts.length} posts, ${culturePosts.length} culture posts, ${inquiries.length} inquiries, ${seoRecords.length} SEO records\n`,
  )

  // Step 2: Migrate Media
  console.log('--- Migrating Media ---')
  const mediaUuids = await collectMediaUuids(authors, seoRecords, posts, culturePosts)
  console.log(`Found ${mediaUuids.size} unique media assets to migrate`)
  results.media = await migrateMedia(payload, mediaUuids, idMaps)
  console.log(
    `Media: ${results.media.succeeded} migrated, ${results.media.failed} failed, ${results.media.skipped} skipped\n`,
  )

  // Step 3: Migrate Categories
  console.log('--- Migrating Categories ---')
  results.categories = await migrateCategories(payload, categories, idMaps)
  console.log(
    `Categories: ${results.categories.succeeded} migrated, ${results.categories.failed} failed, ${results.categories.skipped} skipped\n`,
  )

  // Step 4: Migrate Authors
  console.log('--- Migrating Authors ---')
  results.authors = await migrateAuthors(payload, authors, idMaps)
  console.log(
    `Authors: ${results.authors.succeeded} migrated, ${results.authors.failed} failed, ${results.authors.skipped} skipped\n`,
  )

  // Step 5: Migrate Posts
  console.log('--- Migrating Posts ---')
  results.posts = await migratePosts(payload, posts, idMaps)
  console.log(
    `Posts: ${results.posts.succeeded} migrated, ${results.posts.failed} failed, ${results.posts.skipped} skipped\n`,
  )

  // Step 6: Migrate Culture Posts
  console.log('--- Migrating Culture Posts ---')
  results.culturePosts = await migrateCulturePosts(payload, culturePosts, idMaps)
  console.log(
    `Culture Posts: ${results.culturePosts.succeeded} migrated, ${results.culturePosts.failed} failed, ${results.culturePosts.skipped} skipped\n`,
  )

  // Step 7: Migrate Inquiries
  console.log('--- Migrating Inquiries ---')
  results.inquiries = await migrateInquiries(payload, inquiries)
  console.log(
    `Inquiries: ${results.inquiries.succeeded} migrated, ${results.inquiries.failed} failed, ${results.inquiries.skipped} skipped\n`,
  )

  // Summary
  console.log('=== Migration Summary ===')
  const totalSucceeded = Object.values(results).reduce((sum, r) => sum + r.succeeded, 0)
  const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0)
  const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0)

  for (const [collection, result] of Object.entries(results)) {
    console.log(
      `  ${collection}: ${result.succeeded} ok, ${result.failed} failed, ${result.skipped} skipped`,
    )
  }
  console.log(`\nTotal: ${totalSucceeded} migrated, ${totalFailed} failed, ${totalSkipped} skipped`)

  if (totalFailed > 0) {
    console.log('\n⚠ Some records failed to migrate. Review errors above and re-run if needed.')
    process.exit(1)
  }

  console.log('\nMigration completed successfully!')
  process.exit(0)
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
