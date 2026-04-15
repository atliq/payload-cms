import type { BasePayload } from 'payload'
import { downloadAsset, fetchFileInfo } from './directus-client'
import type { IdMaps } from './id-map'

export async function collectMediaUuids(
  authors: any[],
  seoRecords: any[],
  posts: any[],
  culturePosts: any[],
): Promise<Set<string>> {
  const uuids = new Set<string>()

  // Author profile images
  for (const author of authors) {
    if (author.profile) uuids.add(author.profile)
  }

  // SEO og_images
  for (const seo of seoRecords) {
    if (seo.og_image) uuids.add(seo.og_image)
  }

  // Scan HTML content for embedded Directus asset URLs
  const assetUrlRegex = /wp-api\.atliq\.com\/assets\/([a-f0-9-]{36})/gi
  for (const post of [...posts, ...culturePosts]) {
    const content = post.content || ''
    let match
    while ((match = assetUrlRegex.exec(content)) !== null) {
      uuids.add(match[1])
    }
  }

  return uuids
}

export async function migrateMedia(
  payload: BasePayload,
  uuids: Set<string>,
  idMaps: IdMaps,
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const uuid of uuids) {
    if (idMaps.media.has(uuid)) {
      skipped++
      continue
    }

    try {
      // Get file info from Directus for alt text / filename
      const fileInfo = await fetchFileInfo(uuid)
      const filename = fileInfo?.filename_download || `${uuid}.jpg`
      const altText = fileInfo?.title || fileInfo?.filename_download || 'Migrated image'

      // Check if already exists in Payload by filename
      const existing = await payload.find({
        collection: 'media',
        where: { filename: { equals: filename } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        idMaps.media.set(uuid, existing.docs[0].id)
        skipped++
        console.log(`  [skip] Media already exists: ${filename}`)
        continue
      }

      // Download from Directus
      const { buffer, contentType } = await downloadAsset(uuid)

      // Upload to Payload
      const result = await payload.create({
        collection: 'media',
        data: { alt: altText },
        file: {
          data: buffer as unknown as Buffer,
          mimetype: contentType,
          name: filename,
          size: buffer.length,
        },
      })

      idMaps.media.set(uuid, result.id)
      succeeded++
      console.log(`  [ok] Media migrated: ${filename} -> ID ${result.id}`)

      // Small delay to avoid overwhelming Directus
      await new Promise((r) => setTimeout(r, 100))
    } catch (error) {
      failed++
      console.error(`  [fail] Media ${uuid}:`, (error as Error).message)
    }
  }

  return { succeeded, failed, skipped }
}
