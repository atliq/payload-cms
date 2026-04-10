# Directus to Payload CMS Migration

## Overview

Migrates all content from Directus (`wp-api.atliq.com`) into this Payload CMS instance (D1 SQLite + Cloudflare R2). The frontend at `atliq-website` is updated to consume Payload's API instead of Directus.

**Migration order:** Media → Categories → Authors → Posts → CulturePosts → Inquiries

---

## Running Locally

### Prerequisites

- Node.js ≥ 20, yarn installed
- Dependencies installed: `yarn install`
- `.env` file present with `PAYLOAD_SECRET` (already committed)

### Step 1 — Apply DB migrations (one time)

Creates all tables in the local SQLite file. Run this before the migration script, and any time new migrations are added.

```bash
yarn payload migrate
```

This uses wrangler's `getPlatformProxy` to create a local SQLite DB at `.wrangler/state/v3/d1/`. No Cloudflare credentials required.

### Step 2 — Run the data migration script

```bash
yarn migrate:directus
```

> **Do not run this while `yarn dev` is running.** Both open the same SQLite file and you'll get locking errors.

What it does:
1. Connects to the live Directus API at `wp-api.atliq.com`
2. Downloads all media assets from Directus, uploads them to the local R2 simulation (`.wrangler/state/v3/r2/`)
3. Inserts categories, authors, posts, culture posts, inquiries into local D1 in dependency order
4. Skips records that already exist — safe to re-run on partial failure

Expected output:
```
=== Directus to Payload CMS Migration ===
Initializing Payload...
Fetching data from Directus...
Fetched: 12 authors, 7 categories, 150 posts, ...
--- Migrating Media ---
  [ok] Media migrated: hero.jpg -> ID 1
--- Migrating Categories ---
  [ok] Category: ai-and-data -> ID 1
...
=== Migration Summary ===
  media: 80 ok, 0 failed, 0 skipped
  categories: 7 ok, 0 failed, 0 skipped
  authors: 12 ok, 0 failed, 0 skipped
  posts: 150 ok, 2 failed, 0 skipped
  culturePosts: 25 ok, 0 failed, 0 skipped
  inquiries: 40 ok, 0 failed, 0 skipped
```

### Step 3 — Start the admin panel

```bash
PORT=3001 yarn dev
```

Visit **http://localhost:3001/admin**. On first visit you'll be prompted to create an admin user. Check each collection to verify the migrated data.

### Step 4 — Test the API

```bash
curl "http://localhost:3001/api/posts?where[status][equals]=published&limit=5&depth=2"
curl "http://localhost:3001/api/authors?limit=5"
curl "http://localhost:3001/api/categories"
```

### Step 5 — Connect the frontend

In the `atliq-website` project, create `.env.local`:

```
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3001
```

Then start the frontend in a separate terminal:

```bash
cd ../atliq-website
yarn dev   # starts on http://localhost:3000
```

### Re-running after a partial failure

The migration is idempotent. Each collection checks for existing records by slug before inserting. Just re-run:

```bash
yarn migrate:directus
```

### Wiping and starting fresh

```bash
rm -rf .wrangler/state
yarn payload migrate       # recreate tables
yarn migrate:directus      # re-run migration
```

---

## Deploying to Production

### 1. Deploy the database schema

```bash
CLOUDFLARE_ENV=production yarn deploy:database
```

This runs `payload migrate` against the remote D1 database via wrangler.

### 2. Run the migration script against production

The migration script uses Payload's Local API and talks directly to D1. To target production D1, set `NODE_ENV=production` so `remoteBindings: true` is passed to `getPlatformProxy`:

```bash
NODE_ENV=production yarn migrate:directus
```

> This writes directly to the production D1 database and production R2 bucket. Run only once after verifying locally.

### 3. Deploy the Payload CMS app

```bash
CLOUDFLARE_ENV=production yarn deploy:app
```

Configure the custom domain `cms.atliq.com` in the Cloudflare dashboard pointing to this Worker.

### 4. Update the frontend environment variable

In the Cloudflare dashboard for the `atliq-website` Worker, set:

```
NEXT_PUBLIC_API_ENDPOINT=https://cms.atliq.com
```

Redeploy the frontend.

---

## Architecture Notes

### Content storage

| Field | Storage |
|---|---|
| Rich text (new edits) | Lexical JSON in `content` / `description` column |
| Original Directus HTML | Plain text in `legacyContent` / `legacyDescription` column |

The frontend checks `legacyContent` first (all migrated posts have it), falling back to Lexical for newly created posts.

### SEO

Directus stored SEO as a separate collection with M2M junction tables. Payload stores SEO as an embedded `group` field directly on each collection — no joins needed.

| Directus path | Payload path |
|---|---|
| `post.seo[0].SEO_id.title` | `post.seo.title` |
| `post.seo[0].SEO_id.meta_description` | `post.seo.metaDescription` |
| `post.seo[0].SEO_id.og_image` (UUID) | `post.seo.ogImage.url` (full URL) |
| `post.seo[0].SEO_id.yoast_head_robots.index` | `!post.seo.noIndex` (inverted boolean) |

### Categories

Directus used integer IDs (52, 105–108). Payload uses auto-increment IDs that differ. The frontend was updated to filter by `slug` instead of `id` throughout.

### Image URLs

Directus: `${baseUrl}/assets/${uuid}` constructed in components  
Payload: full URL resolved in the service layer via `resolveMediaUrl()`, components receive a plain string

### Local R2 behavior

In local dev, R2 is simulated by wrangler in `.wrangler/state/v3/r2/`. Image URLs in API responses will be relative paths. In production they become full `https://*.r2.dev` URLs (or your configured public domain).

### D1 `"remote": true` in wrangler.jsonc

This flag is present but overridden by `remoteBindings: false` in `getPlatformProxy()` during local dev, so local always uses the local SQLite file.

---

## Migration Script Structure

```
src/scripts/
  migrate-from-directus.ts              # Main orchestrator
  migration/
    directus-client.ts                  # Fetch from Directus API with auth token
    html-to-lexical.ts                  # HTML → Lexical JSON converter (JSDOM)
    media-migrator.ts                   # Download from Directus, upload to Payload/R2
    id-map.ts                           # Directus ID → Payload ID mappings
    collections/
      migrate-categories.ts
      migrate-authors.ts
      migrate-posts.ts
      migrate-culture-posts.ts
      migrate-inquiries.ts
```

Directus API base URL: `https://wp-api.atliq.com`  
Auth token: stored in `directus-client.ts`
