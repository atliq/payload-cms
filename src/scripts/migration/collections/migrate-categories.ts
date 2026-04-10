import type { BasePayload } from 'payload'
import type { IdMaps } from '../id-map'

export async function migrateCategories(
  payload: BasePayload,
  categories: any[],
  idMaps: IdMaps,
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const cat of categories) {
    try {
      const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      const existing = await payload.find({
        collection: 'categories',
        where: { slug: { equals: slug } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        idMaps.categories.set(cat.id, existing.docs[0].id)
        skipped++
        console.log(`  [skip] Category exists: ${cat.name}`)
        continue
      }

      const result = await payload.create({
        collection: 'categories',
        data: {
          name: cat.name,
          slug,
        },
      })

      idMaps.categories.set(cat.id, result.id)
      succeeded++
      console.log(`  [ok] Category: ${cat.name} (${cat.id} -> ${result.id})`)
    } catch (error) {
      failed++
      console.error(`  [fail] Category ${cat.name}:`, (error as Error).message)
    }
  }

  return { succeeded, failed, skipped }
}
