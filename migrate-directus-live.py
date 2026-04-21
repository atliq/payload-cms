#!/usr/bin/env python3
"""
Directus → Payload CMS Live Migration
--------------------------------------
Fetches data directly from Directus API and imports to live Payload CMS.

Usage:
  python3 migrate-directus-live.py --email admin@example.com --password yourpass

  # Dry run (fetch & parse only, no writes):
  python3 migrate-directus-live.py --email admin@example.com --password yourpass --dry-run

  # Skip specific collections:
  python3 migrate-directus-live.py --email admin@example.com --password yourpass --skip media

Requirements:
  pip install requests
"""
import sys
import json
import time
import argparse
import logging
import mimetypes
import tempfile
import os
from io import BytesIO
from typing import Dict, Any, Optional
from urllib.parse import urljoin

import requests

# ── Config ──────────────────────────────────────────────────────────────────
DIRECTUS_URL = 'https://wp-api.atliq.com'
DIRECTUS_TOKEN = 'tWJb85pfj61CxOsCrrpBpiWwe54CyucB'
PAYLOAD_URL = 'https://payload-cms.atliq.workers.dev'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)-8s %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)


# ── Directus client ──────────────────────────────────────────────────────────

class DirectusClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers['Authorization'] = f'Bearer {DIRECTUS_TOKEN}'

    def get(self, path: str) -> Any:
        url = DIRECTUS_URL + path
        resp = self.session.get(url, timeout=60)
        resp.raise_for_status()
        return resp.json()['data']

    def fetch_authors(self):
        return self.get('/items/Author?fields=*,seo.SEO_id.*&limit=-1')

    def fetch_categories(self):
        return self.get('/items/Categories?fields=*&limit=-1')

    def fetch_posts(self):
        return self.get('/items/Posts?fields=*,categories.Categories_id.*,seo.SEO_id.*,author.id&limit=-1')

    def fetch_culture_posts(self):
        return self.get('/items/CulturePosts?fields=*,categories.Categories_id.*,seo.SEO_id.*&limit=-1')

    def fetch_inquiries(self):
        return self.get('/items/Inquiries?fields=*&limit=-1')

    def fetch_file_meta(self, uuid: str) -> Dict[str, Any]:
        """Fetch Directus file metadata (title, description, etc.)."""
        try:
            resp = self.session.get(f'{DIRECTUS_URL}/files/{uuid}', timeout=30)
            if resp.ok:
                return resp.json().get('data') or {}
        except Exception:
            pass
        return {}

    def download_asset(self, uuid: str) -> Optional[tuple]:
        """Returns (bytes, filename, content_type, alt) or None on failure."""
        url = f'{DIRECTUS_URL}/assets/{uuid}'
        try:
            resp = self.session.get(url, timeout=120, stream=True)
            if not resp.ok:
                log.warning(f'Asset {uuid} returned {resp.status_code}')
                return None
            content_type = resp.headers.get('content-type', 'application/octet-stream').split(';')[0]
            disposition = resp.headers.get('content-disposition', '')
            filename = uuid
            for part in disposition.split(';'):
                part = part.strip()
                if part.startswith('filename=') or part.startswith("filename*=UTF-8''"):
                    filename = part.split('=', 1)[1].strip('"').strip("'")
                    filename = requests.utils.unquote(filename)
                    break
            if '.' not in filename:
                ext = mimetypes.guess_extension(content_type) or ''
                filename = uuid + ext
            # Use filename (without extension) as alt fallback
            alt = filename.rsplit('.', 1)[0].replace('-', ' ').replace('_', ' ').strip()
            return resp.content, filename, content_type, alt
        except Exception as e:
            log.warning(f'Failed to download asset {uuid}: {e}')
            return None


# ── Payload client ───────────────────────────────────────────────────────────

class PayloadMigrator:
    def __init__(self, dry_run: bool = False, limit: Optional[int] = None):
        self.dry_run = dry_run
        self.limit = limit  # None = no limit
        self.session = requests.Session()
        self.directus = DirectusClient()
        self.id_maps: Dict[str, Dict[Any, Any]] = {
            'media': {},
            'categories': {},
            'authors': {},
            'posts': {},
            'culture-posts': {},
            'inquiries': {},
        }
        self.stats: Dict[str, Dict[str, int]] = {}

    def login(self, email: str, password: str) -> bool:
        try:
            resp = self.session.post(
                f'{PAYLOAD_URL}/api/users/login',
                json={'email': email, 'password': password},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            # Store token for Authorization header (Cloudflare Workers may not relay cookies well)
            token = data.get('token')
            if token:
                self.session.headers['Authorization'] = f'Bearer {token}'
            log.info('✅ Logged in to Payload CMS')
            return True
        except Exception as e:
            log.error(f'❌ Login failed: {e}')
            if hasattr(e, 'response') and e.response is not None:
                log.error(f'   Response: {e.response.text[:500]}')
            return False

    def _post(self, collection: str, data: Dict[str, Any]) -> Optional[Dict]:
        if self.dry_run:
            log.info(f'[DRY RUN] Would POST /{collection}: {json.dumps(data)[:120]}')
            return {'id': f'dry-{collection}'}
        try:
            resp = self.session.post(
                f'{PAYLOAD_URL}/api/{collection}',
                json=data,
                timeout=60,
            )
            if resp.status_code in (400, 409):
                existing = self._find_existing(collection, data)
                if existing:
                    return existing
            resp.raise_for_status()
            return resp.json().get('doc') or resp.json()
        except Exception as e:
            log.error(f'❌ POST /{collection} failed: {e}')
            if hasattr(e, 'response') and e.response is not None:
                log.error(f'   Response: {e.response.text[:500]}')
            return None

    def _find_existing(self, collection: str, data: Dict[str, Any]) -> Optional[Dict]:
        params = {}
        if 'slug' in data and data['slug']:
            params['where[slug][equals]'] = data['slug']
        elif 'email' in data and data['email']:
            params['where[email][equals]'] = data['email']
        elif 'filename' in data and data['filename']:
            params['where[filename][equals]'] = data['filename']
        else:
            return None
        try:
            resp = self.session.get(f'{PAYLOAD_URL}/api/{collection}', params=params, timeout=30)
            resp.raise_for_status()
            docs = resp.json().get('docs', [])
            if docs:
                return docs[0]
        except Exception:
            pass
        return None

    def _upload_media(self, asset_bytes: bytes, filename: str, content_type: str, alt: str = '') -> Optional[Dict]:
        if self.dry_run:
            log.info(f'[DRY RUN] Would upload media: {filename}')
            return {'id': f'dry-media-{filename}'}
        try:
            files = {'file': (filename, BytesIO(asset_bytes), content_type)}
            # Payload v3 requires extra fields as _payload JSON in multipart uploads
            data = {'_payload': json.dumps({'alt': alt or filename})}
            resp = self.session.post(
                f'{PAYLOAD_URL}/api/media',
                files=files,
                data=data,
                timeout=120,
            )
            if resp.status_code in (400, 409):
                existing = self._find_existing('media', {'filename': filename})
                if existing:
                    return existing
            resp.raise_for_status()
            return resp.json().get('doc') or resp.json()
        except Exception as e:
            log.error(f'❌ Media upload failed ({filename}): {e}')
            if hasattr(e, 'response') and e.response is not None:
                log.error(f'   Response: {e.response.text[:500]}')
            return None

    def _stat(self, collection: str, status: str):
        s = self.stats.setdefault(collection, {'imported': 0, 'skipped': 0, 'failed': 0})
        s[status] += 1

    # ── Extract SEO from Directus record ──────────────────────────────────────

    VALID_CHANGE_FREQ = {'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'}

    def _extract_seo(self, seo_junction: Any) -> Dict[str, Any]:
        """Handles seo.SEO_id.* expanded Directus SEO fields."""
        seo: Dict[str, Any] = {}
        if not seo_junction:
            return seo
        items = seo_junction if isinstance(seo_junction, list) else [seo_junction]
        for item in items:
            rec = item.get('SEO_id') or item if isinstance(item, dict) else {}
            title = (rec.get('title') or '')[:70]
            meta_desc = (rec.get('meta_description') or '')[:160]
            freq = (rec.get('sitemap_change_frequency') or '').lower().strip()
            seo = {
                'title': title,
                'metaDescription': meta_desc,
                'canonicalUrl': rec.get('canonical_url') or '',
                'noIndex': bool(rec.get('no_index', False)),
                'noFollow': bool(rec.get('no_follow', False)),
                'sitemapPriority': rec.get('sitemap_priority'),
            }
            if freq in self.VALID_CHANGE_FREQ:
                seo['sitemapChangeFrequency'] = freq
            og = rec.get('og_image')
            if og:
                payload_id = self.id_maps['media'].get(og)
                if payload_id:
                    seo['ogImage'] = payload_id
            break  # take first SEO record
        return seo

    # ── Media ─────────────────────────────────────────────────────────────────

    def migrate_media(self, uuids: list) -> None:
        log.info(f'\n🖼  Migrating media ({len(uuids)} assets)...')
        for uuid in uuids:
            if uuid in self.id_maps['media']:
                continue
            asset = self.directus.download_asset(uuid)
            if not asset:
                self._stat('media', 'failed')
                continue
            asset_bytes, filename, content_type, alt = asset
            # Check by real filename (not UUID)
            existing = self._find_existing('media', {'filename': filename})
            if existing:
                self.id_maps['media'][uuid] = existing['id']
                self._stat('media', 'skipped')
                continue
            result = self._upload_media(asset_bytes, filename, content_type, alt)
            if result:
                self.id_maps['media'][uuid] = result['id']
                log.info(f'  ✅ Media {filename} → {result["id"]}')
                self._stat('media', 'imported')
            else:
                self._stat('media', 'failed')
            time.sleep(0.2)  # be gentle on the API

    # ── Categories ────────────────────────────────────────────────────────────

    @staticmethod
    def _normalize_slug(slug: str) -> str:
        return slug.strip().lower().replace('_', '-').replace(' ', '-') if slug else ''

    def migrate_categories(self) -> None:
        log.info('\n📂 Migrating categories...')
        records = self.directus.fetch_categories()
        # No limit — categories are few and posts depend on all of them
        for rec in records:
            slug = self._normalize_slug(rec.get('slug') or '')
            existing = self._find_existing('categories', {'slug': slug})
            if existing:
                self.id_maps['categories'][rec['id']] = existing['id']
                self._stat('categories', 'skipped')
                continue
            data = {
                'name': rec.get('name', ''),
                'slug': slug,
            }
            result = self._post('categories', data)
            if result:
                self.id_maps['categories'][rec['id']] = result['id']
                log.info(f'  ✅ Category: {rec["name"]} → {result["id"]}')
                self._stat('categories', 'imported')
            else:
                self._stat('categories', 'failed')

    # ── Authors ───────────────────────────────────────────────────────────────

    def migrate_authors(self) -> None:
        log.info('\n👤 Migrating authors...')
        records = self.directus.fetch_authors()
        # No limit — authors are few and posts depend on all of them
        for rec in records:
            slug = self._normalize_slug(rec.get('slug') or '')
            existing = self._find_existing('authors', {'slug': slug})
            if existing:
                self.id_maps['authors'][rec['id']] = existing['id']
                self._stat('authors', 'skipped')
                continue
            profile_uuid = rec.get('profile')
            data = {
                'name': rec.get('name', ''),
                'slug': slug,
                'status': rec.get('status', 'published'),
                'linkedinUrl': rec.get('linkedin_url', '') or '',
                'legacyDescription': rec.get('description', '') or '',
                'profile': self.id_maps['media'].get(profile_uuid) if profile_uuid else None,
                'seo': self._extract_seo(rec.get('seo')),
            }
            result = self._post('authors', data)
            if result:
                self.id_maps['authors'][rec['id']] = result['id']
                log.info(f'  ✅ Author: {rec["name"]} → {result["id"]}')
                self._stat('authors', 'imported')
            else:
                self._stat('authors', 'failed')

    # ── Posts ─────────────────────────────────────────────────────────────────

    def migrate_posts(self) -> None:
        log.info('\n📝 Migrating posts...')
        records = self.directus.fetch_posts()
        if self.limit:
            records = records[:self.limit]
        for rec in records:
            slug = self._normalize_slug(rec.get('slug') or '')
            existing = self._find_existing('posts', {'slug': slug})
            if existing:
                self.id_maps['posts'][rec['id']] = existing['id']
                self._stat('posts', 'skipped')
                continue

            # Resolve category IDs
            categories = []
            for cat_junction in (rec.get('categories') or []):
                cat_rec = cat_junction.get('Categories_id') if isinstance(cat_junction, dict) else None
                if cat_rec and cat_rec.get('id'):
                    payload_cat = self.id_maps['categories'].get(cat_rec['id'])
                    if payload_cat:
                        categories.append(payload_cat)

            # Resolve author ID
            author_ref = rec.get('author')
            author_id = None
            if isinstance(author_ref, dict):
                author_id = self.id_maps['authors'].get(author_ref.get('id'))
            elif author_ref:
                author_id = self.id_maps['authors'].get(author_ref)

            data = {
                'title': rec.get('title', ''),
                'slug': slug,
                'status': rec.get('status', 'published'),
                'publishedAt': rec.get('date') or rec.get('date_created'),
                'excerpt': rec.get('excerpt') or '',
                'legacyContent': rec.get('content') or '',
                'categories': categories,
                'author': author_id,
                'seo': self._extract_seo(rec.get('seo')),
            }

            # Tags
            tags_raw = rec.get('tags')
            if tags_raw:
                if isinstance(tags_raw, list):
                    data['tags'] = [{'tag': t} for t in tags_raw if t]
                elif isinstance(tags_raw, str):
                    try:
                        data['tags'] = [{'tag': t} for t in json.loads(tags_raw) if t]
                    except Exception:
                        pass

            result = self._post('posts', data)
            if result:
                self.id_maps['posts'][rec['id']] = result['id']
                log.info(f'  ✅ Post: {rec.get("title","?")[:60]} → {result["id"]}')
                self._stat('posts', 'imported')
            else:
                self._stat('posts', 'failed')

    # ── Culture Posts ─────────────────────────────────────────────────────────

    def migrate_culture_posts(self) -> None:
        log.info('\n🌱 Migrating culture posts...')
        records = self.directus.fetch_culture_posts()
        if self.limit:
            records = records[:self.limit]
        for rec in records:
            slug = self._normalize_slug(rec.get('slug') or '')
            existing = self._find_existing('culture-posts', {'slug': slug})
            if existing:
                self.id_maps['culture-posts'][rec['id']] = existing['id']
                self._stat('culture-posts', 'skipped')
                continue

            categories = []
            for cat_junction in (rec.get('categories') or []):
                cat_rec = cat_junction.get('Categories_id') if isinstance(cat_junction, dict) else None
                if cat_rec and cat_rec.get('id'):
                    payload_cat = self.id_maps['categories'].get(cat_rec['id'])
                    if payload_cat:
                        categories.append(payload_cat)

            data = {
                'title': rec.get('title', ''),
                'slug': slug,
                'status': rec.get('status', 'published'),
                'publishedAt': rec.get('date') or rec.get('date_created'),
                'excerpt': rec.get('excerpt') or '',
                'legacyContent': rec.get('content') or '',
                'categories': categories,
                'seo': self._extract_seo(rec.get('seo')),
            }

            result = self._post('culture-posts', data)
            if result:
                self.id_maps['culture-posts'][rec['id']] = result['id']
                log.info(f'  ✅ CulturePost: {rec.get("title","?")[:60]} → {result["id"]}')
                self._stat('culture-posts', 'imported')
            else:
                self._stat('culture-posts', 'failed')

    # ── Inquiries ─────────────────────────────────────────────────────────────

    def migrate_inquiries(self) -> None:
        log.info('\n📥 Migrating inquiries...')
        records = self.directus.fetch_inquiries()
        if self.limit:
            records = records[:self.limit]
        for rec in records:
            existing = self._find_existing('inquiries', {'email': rec.get('email', '')})
            if existing:
                self._stat('inquiries', 'skipped')
                continue

            data = {
                'name': rec.get('name', '') or '',
                'email': rec.get('email', '') or '',
                'phone': rec.get('phone', '') or '',
                'company': rec.get('company', '') or '',
                'website': rec.get('website', '') or '',
                'subject': rec.get('subject', '') or '',
                'message': rec.get('message', '') or '',
                'sourceIp': rec.get('source_ip', '') or '',
                'status': rec.get('status') if rec.get('status') in ('new', 'reviewed', 'archived') else 'new',
            }

            result = self._post('inquiries', data)
            if result:
                self._stat('inquiries', 'imported')
            else:
                self._stat('inquiries', 'failed')

    # ── Collect all asset UUIDs referenced across all records ─────────────────

    def _collect_asset_uuids(self) -> list:
        uuids = set()
        try:
            for author in self.directus.fetch_authors():
                if author.get('profile'):
                    uuids.add(author['profile'])
                for seo_item in (author.get('seo') or []):
                    seo = seo_item.get('SEO_id') if isinstance(seo_item, dict) else {}
                    if seo and seo.get('og_image'):
                        uuids.add(seo['og_image'])
        except Exception as e:
            log.warning(f'Failed to collect author assets: {e}')
        try:
            for post in self.directus.fetch_posts():
                if post.get('featured_image'):
                    uuids.add(post['featured_image'])
                for seo_item in (post.get('seo') or []):
                    seo = seo_item.get('SEO_id') if isinstance(seo_item, dict) else {}
                    if seo and seo.get('og_image'):
                        uuids.add(seo['og_image'])
        except Exception as e:
            log.warning(f'Failed to collect post assets: {e}')
        try:
            for post in self.directus.fetch_culture_posts():
                if post.get('featured_image'):
                    uuids.add(post['featured_image'])
                for seo_item in (post.get('seo') or []):
                    seo = seo_item.get('SEO_id') if isinstance(seo_item, dict) else {}
                    if seo and seo.get('og_image'):
                        uuids.add(seo['og_image'])
        except Exception as e:
            log.warning(f'Failed to collect culture post assets: {e}')
        return list(uuids)

    # ── Full migration ─────────────────────────────────────────────────────────

    def run(self, skip: list = None) -> None:
        skip = skip or []
        log.info(f'🚀 Starting migration → {PAYLOAD_URL}')
        if self.dry_run:
            log.info('   [DRY RUN MODE — no data will be written]')

        if 'media' not in skip:
            log.info('\n🔍 Collecting media asset UUIDs from Directus...')
            uuids = self._collect_asset_uuids()
            log.info(f'   Found {len(uuids)} unique assets')
            self.migrate_media(uuids)
        else:
            log.info('\n⏭  Skipping media')

        if 'categories' not in skip:
            self.migrate_categories()
        if 'authors' not in skip:
            self.migrate_authors()
        if 'posts' not in skip:
            self.migrate_posts()
        if 'culture-posts' not in skip:
            self.migrate_culture_posts()
        if 'inquiries' not in skip:
            self.migrate_inquiries()

        log.info('\n' + '='*60)
        log.info('🎉 MIGRATION COMPLETE')
        log.info('='*60)
        log.info(f'{"Collection":<20} {"Imported":>10} {"Skipped":>10} {"Failed":>10}')
        log.info('-'*52)
        for col, s in self.stats.items():
            log.info(f'{col:<20} {s.get("imported",0):>10} {s.get("skipped",0):>10} {s.get("failed",0):>10}')


def main():
    parser = argparse.ArgumentParser(description='Migrate Directus data to Payload CMS live instance')
    parser.add_argument('--email', required=True, help='Payload admin email')
    parser.add_argument('--password', required=True, help='Payload admin password')
    parser.add_argument('--dry-run', action='store_true', help='Parse & log only, no writes')
    parser.add_argument('--limit', type=int, default=None,
                        help='Max records per collection (e.g. 5 for a test run)')
    parser.add_argument('--skip', nargs='*', default=[],
                        choices=['media', 'categories', 'authors', 'posts', 'culture-posts', 'inquiries'],
                        help='Collections to skip')
    args = parser.parse_args()

    migrator = PayloadMigrator(dry_run=args.dry_run, limit=args.limit)
    if not migrator.login(args.email, args.password):
        sys.exit(1)
    migrator.run(skip=args.skip)


if __name__ == '__main__':
    main()
