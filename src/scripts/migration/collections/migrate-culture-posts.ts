import type { BasePayload } from 'payload'
import type { IdMaps } from '../id-map'
import { htmlToLexical } from '../html-to-lexical'

function stripSlugPrefix(slug: string): string {
  if (!slug) return slug
  return slug
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^\/+/, '')
}

const VALID_FREQUENCIES = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']

function extractSeo(post: any, idMaps: IdMaps) {
  const seoRel = post.seo?.[0]?.SEO_id
  if (!seoRel) return {}

  const freq = seoRel.sitemap_change_frequency
  return {
    seo: {
      title: seoRel.title ? String(seoRel.title).substring(0, 70) : '',
      metaDescription: seoRel.meta_description
        ? String(seoRel.meta_description).substring(0, 160)
        : '',
      canonicalUrl: seoRel.canonical_url || '',
      noIndex: Boolean(seoRel.no_index),
      noFollow: Boolean(seoRel.no_follow),
      ogImage: seoRel.og_image ? idMaps.media.get(seoRel.og_image) || undefined : undefined,
      sitemapChangeFrequency: VALID_FREQUENCIES.includes(freq) ? freq : undefined,
      sitemapPriority: seoRel.sitemap_priority ?? undefined,
    },
  }
}

function mapCategories(post: any, idMaps: IdMaps): number[] {
  if (!post.categories || !Array.isArray(post.categories)) return []
  return post.categories
    .map((c: any) => {
      const directusId = c.Categories_id?.id ?? c.Categories_id
      return idMaps.categories.get(directusId)
    })
    .filter(Boolean) as number[]
}

function mapTags(post: any): { tag: string }[] {
  if (!post.tags || !Array.isArray(post.tags)) return []
  return post.tags.map((t: string) => ({ tag: t }))
}

export async function migrateCulturePosts(
  payload: BasePayload,
  culturePosts: any[],
  idMaps: IdMaps,
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const post of culturePosts) {
    try {
      const slug = stripSlugPrefix(post.slug)

      const existing = await payload.find({
        collection: 'culture-posts',
        where: { slug: { equals: slug } },
        limit: 1,
      })

      const categoryIds = mapCategories(post, idMaps)
      const tags = mapTags(post)
      const lexicalContent = htmlToLexical(post.content || '', idMaps)
      const seoData = extractSeo(post, idMaps)

      const postData = {
        title: post.title,
        slug,
        status: post.status || 'published',
        publishedAt: post.date || post.date_created,
        content: lexicalContent,
        legacyContent: post.content || '',
        excerpt: post.excerpt || '',
        categories: categoryIds,
        tags,
        ...seoData,
      }

      if (existing.docs.length > 0) {
        const payloadId = existing.docs[0].id
        await payload.update({ collection: 'culture-posts', id: payloadId, data: postData })
        idMaps.culturePosts.set(post.id, payloadId)
        succeeded++
        console.log(`  [update] Culture post: ${post.title}`)
      } else {
        const result = await payload.create({ collection: 'culture-posts', data: postData })
        idMaps.culturePosts.set(post.id, result.id)
        succeeded++
        console.log(`  [create] Culture post: ${post.title} (${post.id} -> ${result.id})`)
      }
    } catch (error) {
      failed++
      console.error(`  [fail] Culture post "${post.title}":`, (error as Error).message)
    }
  }

  return { succeeded, failed, skipped }
}
