import type { BasePayload } from 'payload'
import type { IdMaps } from '../id-map'
import { htmlToLexical } from '../html-to-lexical'

function stripSlugPrefix(slug: string): string {
  if (!slug) return slug
  // Remove known URL prefixes
  return slug
    .replace(/^https?:\/\/[^/]+\/author\//, '')
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^\/+/, '')
}

function extractSeo(author: any, idMaps: IdMaps) {
  const seoRel = author.seo?.[0]?.SEO_id
  if (!seoRel) return {}

  return {
    seo: {
      title: seoRel.title || '',
      metaDescription: seoRel.meta_description || '',
      canonicalUrl: seoRel.canonical_url || '',
      noIndex: Boolean(seoRel.no_index),
      noFollow: Boolean(seoRel.no_follow),
      ogImage: seoRel.og_image ? idMaps.media.get(seoRel.og_image) || undefined : undefined,
      sitemapChangeFrequency: seoRel.sitemap_change_frequency || undefined,
      sitemapPriority: seoRel.sitemap_priority ?? undefined,
    },
  }
}

export async function migrateAuthors(
  payload: BasePayload,
  authors: any[],
  idMaps: IdMaps,
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const author of authors) {
    try {
      const slug = stripSlugPrefix(author.slug)

      const existing = await payload.find({
        collection: 'authors',
        where: { slug: { equals: slug } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        idMaps.authors.set(author.id, existing.docs[0].id)
        skipped++
        console.log(`  [skip] Author exists: ${author.name}`)
        continue
      }

      const profileMediaId = author.profile ? idMaps.media.get(author.profile) : undefined
      const lexicalDescription = htmlToLexical(author.description || '')
      const seoData = extractSeo(author, idMaps)

      const result = await payload.create({
        collection: 'authors',
        data: {
          name: author.name,
          slug,
          status: author.status || 'published',
          profile: profileMediaId,
          linkedinUrl: author.linkedin_url || '',
          description: lexicalDescription,
          legacyDescription: author.description || '',
          ...seoData,
        },
      })

      idMaps.authors.set(author.id, result.id)
      succeeded++
      console.log(`  [ok] Author: ${author.name} (${author.id} -> ${result.id})`)
    } catch (error) {
      failed++
      console.error(`  [fail] Author ${author.name}:`, (error as Error).message)
    }
  }

  return { succeeded, failed, skipped }
}
